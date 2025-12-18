# Fase 1 – Rotas Finas + Use Cases

## Objetivo

Migrar rotas API que concentram regra de negócio para services em `modules/*/application`, deixando os handlers apenas com:
- Validação de input (schema)
- Autenticação/autorização
- Orquestração (chamada de services)
- Formatação de response HTTP

## Diagnóstico Atual

### Rotas Bem Estruturadas (Referência)
| Rota | Service Usado | Status |
|------|---------------|--------|
| `cotacoes/route.ts` | `modules/quotes/application/service.ts` | ✅ Exemplar |
| `checkout/route.ts` | `modules/cart/application/checkout.service.ts` | ✅ Exemplar |
| `account/cards/route.ts` | `modules/auth/application/account-cards.service.ts` | ✅ OK |
| `account/recipients/route.ts` | `modules/auth/application/account-recipients.service.ts` | ✅ OK |

### Rotas a Refatorar
| Rota | Lógica Inline | Complexidade | Prioridade |
|------|---------------|--------------|------------|
| `cart/route.ts` | CRUD + race conditions + state | ALTA | P1 |
| `cart/items/route.ts` | Item CRUD + recálculo totais | MÉDIA | P1 |
| `cart/items/[id]/route.ts` | Update/Delete + recálculo | MÉDIA | P1 |
| `wallet/debit/route.ts` | Transação atômica + cascatas | MUITO ALTA | P1 |
| `shipments/route.ts` | Filtros + mapping complexo | ALTA | P2 |
| `labels/route.ts` | Mapping complexo + extração | ALTA | P2 |
| `wallet/route.ts` | Balance + agregações | MÉDIA | P2 |
| `wallet/transactions/route.ts` | Filtros + agregações | MÉDIA | P2 |
| `coletas/route.ts` | Filtros + mapping | MÉDIA | P2 |
| `pickup-points/route.ts` | Cache + geocoding | MÉDIA | P2 |
| `recurring-items/route.ts` | CRUD simples | BAIXA | P3 |

---

## Plano Incremental

### Sprint 1: Módulo Cart (P1) - ~4 services

#### 1.1 Criar `modules/cart/application/cart.service.ts`

**Funções a extrair de `app/api/cart/route.ts`:**

```typescript
// modules/cart/application/cart.service.ts
export interface CartService {
  // GET - Obter carrinho aberto do usuário
  getOpenCart(userId: string): Promise<CartDto | null>;

  // POST - Criar ou retornar carrinho aberto existente
  getOrCreateOpenCart(userId: string): Promise<CartDto>;

  // DELETE - Deletar carrinho e resetar
  deleteCart(userId: string, cartId: string): Promise<void>;

  // Recalcular totais (usado por items também)
  recalculateCartTotals(cartId: string): Promise<void>;
}
```

**Lógica a mover:**
- Race condition handling (P2002 unique constraint)
- Validação de propriedade do carrinho
- Gerenciamento de estados (OPEN/LOCKED)
- Cálculo de totais

**Rota resultante (`app/api/cart/route.ts`):**
```typescript
export const GET = withApiHandler(async (req) => {
  const { userId } = await getUserFromRequest(req);
  const cart = await cartService.getOpenCart(userId);
  return { data: cart };
});

export const POST = withApiHandler(async (req) => {
  const { userId } = await getUserFromRequest(req);
  const cart = await cartService.getOrCreateOpenCart(userId);
  return { data: cart };
});

export const DELETE = withApiHandler(async (req) => {
  const { userId } = await getUserFromRequest(req);
  const { searchParams } = new URL(req.url);
  const cartId = searchParams.get('id');
  await cartService.deleteCart(userId, cartId);
  return { data: { success: true } };
});
```

**Validação:**
- [ ] Testes unitários do service
- [ ] Smoke test da rota
- [ ] Verificar race conditions em paralelo

---

#### 1.2 Criar `modules/cart/application/cart-items.service.ts`

**Funções a extrair de `app/api/cart/items/route.ts` e `app/api/cart/items/[id]/route.ts`:**

```typescript
// modules/cart/application/cart-items.service.ts
export interface CartItemsService {
  // GET - Listar itens do carrinho
  listItems(userId: string, cartId: string): Promise<CartItemDto[]>;

  // POST - Adicionar item ao carrinho
  addItem(userId: string, input: AddCartItemInput): Promise<CartItemDto>;

  // PATCH - Atualizar item
  updateItem(userId: string, itemId: string, input: UpdateCartItemInput): Promise<CartItemDto>;

  // DELETE - Remover item
  deleteItem(userId: string, itemId: string): Promise<void>;
}
```

**Lógica a mover:**
- Busca/criação automática de carrinho
- Validação de propriedade
- Recálculo de totais após cada operação
- Race condition handling

**Validação:**
- [ ] Testes unitários do service
- [ ] Smoke test das rotas
- [ ] Verificar integridade de totais

---

#### 1.3 Refatorar `wallet/debit/route.ts` → `modules/wallet/application/debit.service.ts`

**CRÍTICO:** Esta é a rota mais complexa (~300 LOC) com lógica financeira.

**Funções a criar:**

```typescript
// modules/wallet/application/debit.service.ts
export interface WalletDebitService {
  // Debitar carteira para pagamento de envios
  debitForShipments(input: DebitForShipmentsInput): Promise<DebitResult>;
}

interface DebitForShipmentsInput {
  userId: string;
  shipmentIds: string[];
  referenceId: string; // Para idempotência
}

interface DebitResult {
  success: boolean;
  transaction?: WalletTransactionDto;
  shipments?: ShipmentDto[];
}
```

**Lógica a mover:**
- Transação atômica com `prisma.$transaction`
- Pessimistic locking (`FOR UPDATE`)
- Verificação de idempotência
- Validação de saldo
- Atualizações em cascata (wallet, shipments, labels, cart)
- Envio de emails (extrair para job assíncrono)

**Considerações:**
- Manter atomicidade da transação
- Separar envio de emails para fila/job
- Criar testes com mocking de Prisma

**Validação:**
- [ ] Testes unitários com transaction mock
- [ ] Testes de integração com banco real
- [ ] Teste de idempotência
- [ ] Teste de race condition (parallel requests)

---

### Sprint 2: Listagens e Mappings (P2) - ~5 services

#### 2.1 Criar `modules/shipments/application/list.service.ts`

**Extrair de `app/api/shipments/route.ts`:**

```typescript
export interface ShipmentListService {
  listUserShipments(
    userId: string,
    filters: ShipmentFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ShipmentListItemDto>>;
}

interface ShipmentFilters {
  status?: ShipmentStatus[];
  dateRange?: { start: Date; end: Date };
  search?: string;
}
```

**Lógica a mover:**
- Construção de query com filtros
- Status mapping (backend → UI)
- Agregação de labels e divergências
- Cálculo de data prevista de entrega

---

#### 2.2 Criar `modules/labels/application/list.service.ts`

**Extrair de `app/api/labels/route.ts`:**

```typescript
export interface LabelListService {
  listUserLabels(
    userId: string,
    filters: LabelFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<LabelListItemDto>>;
}
```

**Lógica a mover:**
- Mapping complexo de label data
- Processamento de pacotes com status
- Detecção de tipo de conteúdo
- Abreviação de chave NFe
- Agregação de itens de declaração

---

#### 2.3 Criar `modules/wallet/application/statement.service.ts`

**Extrair de `app/api/wallet/transactions/route.ts`:**

```typescript
export interface WalletStatementService {
  getStatement(
    userId: string,
    dateRange: DateRange,
    pagination: PaginationOptions
  ): Promise<WalletStatementDto>;
}
```

**Lógica a mover:**
- Filtros de data
- Agregação de créditos/débitos
- Formatação de transações
- Cálculo de resumo do período

---

#### 2.4 Criar `modules/wallet/application/balance.service.ts`

**Extrair de `app/api/wallet/route.ts`:**

```typescript
export interface WalletBalanceService {
  getWalletOverview(userId: string): Promise<WalletOverviewDto>;
}

interface WalletOverviewDto {
  balance: number;
  monthCredits: number;
  monthDebits: number;
  recentTransactions: WalletTransactionDto[];
}
```

---

#### 2.5 Criar `modules/pickup-points/application/list.service.ts`

**Extrair de `app/api/pickup-points/route.ts`:**

```typescript
export interface PickupPointListService {
  listPickupPoints(
    filters: PickupPointFilters,
    options?: { includeCoordinates?: boolean }
  ): Promise<PickupPointDto[]>;
}
```

**Lógica a mover:**
- Cache-aside pattern
- Geocoding de CEP
- Construção de filtros (city/UF/search)
- Enriquecimento com coordenadas

---

### Sprint 3: Rotas Secundárias (P2/P3) - ~3 services

#### 3.1 Criar `modules/coletas/application/list.service.ts`

**Extrair de `app/api/coletas/route.ts`:**

```typescript
export interface ColetasListService {
  listPickupRequests(
    userId: string,
    filters: PickupRequestFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<PickupRequestDto>>;

  createPickupRequest(
    userId: string,
    input: CreatePickupRequestInput
  ): Promise<PickupRequestDto>;
}
```

---

#### 3.2 Criar `modules/recurring-items/application/service.ts`

**Extrair de `app/api/recurring-items/route.ts`:**

```typescript
export interface RecurringItemsService {
  list(userId: string): Promise<RecurringItemDto[]>;
  create(userId: string, input: CreateRecurringItemInput): Promise<RecurringItemDto>;
  update(userId: string, id: string, input: UpdateRecurringItemInput): Promise<RecurringItemDto>;
  delete(userId: string, id: string): Promise<void>;
}
```

---

#### 3.3 Criar `modules/coletas/application/collector-pickups.service.ts`

**Extrair de `app/api/coletores/coletas/route.ts`:**

```typescript
export interface CollectorPickupsService {
  listAssignedPickups(
    collectorId: string,
    filters: PickupFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CollectorPickupDto>>;
}
```

---

## Checklist de Migração por Rota

Para cada rota migrada, seguir este checklist:

### Pré-migração
- [ ] Ler e entender toda a lógica da rota
- [ ] Identificar dependências (Prisma, cache, integrações)
- [ ] Verificar se já existe service parcial no módulo
- [ ] Listar edge cases e race conditions

### Implementação
- [ ] Criar/estender service no módulo correto
- [ ] Escrever testes unitários do service
- [ ] Refatorar rota para usar service
- [ ] Manter assinatura HTTP idêntica (não breaking change)

### Validação
- [ ] Testes unitários passam
- [ ] Smoke test manual da rota
- [ ] Verificar logs de erro em staging
- [ ] Comparar response antes/depois

### Rollback
- [ ] Manter código original comentado (primeira semana)
- [ ] Documentar como reverter se necessário

---

## Padrões a Seguir

### 1. Estrutura de Service

```typescript
// modules/<feature>/application/<name>.service.ts

import prisma from '@/platform/db/db';
import { logger } from '@/platform/logging/logger';
import { ApiError } from '@/platform/api/errors';

// DTOs
export interface InputDto { ... }
export interface OutputDto { ... }

// Service functions (pure, testable)
export async function doSomething(input: InputDto): Promise<OutputDto> {
  // Validação de negócio
  // Operações de banco
  // Transformação de dados
  // Return DTO (não Prisma model)
}
```

### 2. Rota Fina

```typescript
// app/api/<resource>/route.ts

import { withApiHandler } from '@/platform/api/handler';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { SomeSchema } from '@/shared/validation/<schema>';
import * as service from '@/modules/<feature>/application/<name>.service';

export const GET = withApiHandler(async (req) => {
  // 1. Auth
  const { userId } = await getUserFromRequest(req);

  // 2. Validação de input
  const params = SomeSchema.parse(await req.json());

  // 3. Chamada de service
  const result = await service.doSomething({ userId, ...params });

  // 4. Response HTTP
  return { data: result };
});
```

### 3. Transações Atômicas

```typescript
// Para operações que precisam de atomicidade
export async function atomicOperation(input: Input): Promise<Output> {
  return prisma.$transaction(async (tx) => {
    // Usar tx em vez de prisma para todas as operações
    const wallet = await tx.wallet.findFirst({
      where: { userId: input.userId },
      // Pessimistic lock para race conditions
      // @ts-ignore - Prisma extension
      lock: { mode: 'pessimistic_write' },
    });

    // ... operações atômicas
  });
}
```

### 4. Testes

```typescript
// tests/unit/modules/<feature>/application/<name>.service.test.ts

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import * as service from '@/modules/<feature>/application/<name>.service';

describe('<ServiceName>', () => {
  it('should do something', async () => {
    // Mock prisma
    // Call service
    // Assert result
  });
});
```

---

## Ordem de Execução Sugerida

```
Sprint 1 (Crítico - Cart + Wallet Debit)
├── 1.1 cart.service.ts
├── 1.2 cart-items.service.ts
└── 1.3 debit.service.ts

Sprint 2 (Listagens)
├── 2.1 shipments/list.service.ts
├── 2.2 labels/list.service.ts
├── 2.3 wallet/statement.service.ts
├── 2.4 wallet/balance.service.ts
└── 2.5 pickup-points/list.service.ts

Sprint 3 (Secundários)
├── 3.1 coletas/list.service.ts
├── 3.2 recurring-items/service.ts
└── 3.3 coletas/collector-pickups.service.ts
```

---

## Métricas de Sucesso

- [ ] Todas as rotas P1 e P2 migradas
- [ ] Zero regressões em produção
- [ ] Cobertura de testes > 80% nos services criados
- [ ] Rotas com < 50 LOC (exceto validação de schema)
- [ ] Nenhum import de `@prisma/client` em arquivos de rota

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Regressão funcional | Média | Alto | Testes + rollback plan |
| Race conditions | Média | Alto | Testes paralelos + locks |
| Performance degradada | Baixa | Médio | Benchmarks antes/depois |
| Breaking changes na API | Baixa | Alto | Manter assinaturas HTTP |

---

## Próximos Passos

1. **Revisar este plano** - Validar prioridades e escopo
2. **Criar branch** - `feat/fase1-rotas-finas`
3. **Iniciar Sprint 1** - Cart module primeiro (alta frequência)
4. **Review incremental** - PR por service/rota
