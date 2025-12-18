# Arquitetura: Pagamentos e Carteira

## Visão Geral

Este documento descreve a separação de responsabilidades entre o **módulo de Gateway de Pagamentos** (Mercado Pago) e o **serviço de Carteira** (Wallet).

## Princípios Fundamentais

### 1. Separação de Domínios

Existem dois domínios distintos com responsabilidades claras:

**Domínio de Gateway (Mercado Pago)**
- Gerencia transações externas de pagamento
- Integra com SDK do Mercado Pago
- Tabela: `PaymentTransaction`
- Localização: `lib/mercadopago/*`

**Domínio de Carteira (Wallet)**
- Gerencia saldo interno da plataforma
- Controla créditos e débitos na carteira do usuário
- Tabelas: `Wallet`, `WalletTransaction`
- Localização: `lib/wallet/*`

### 2. Linha de Corte (Boundary)

```
┌─────────────────────────────────────────────────────────────┐
│                    MÓDULO MERCADO PAGO                       │
│                  (lib/mercadopago/*)                         │
│                                                              │
│  Responsabilidades:                                          │
│  ✅ Criar pagamentos no MP (createPayment)                   │
│  ✅ Atualizar status de pagamentos (webhooks)                │
│  ✅ Registrar em PaymentTransaction                          │
│  ✅ Integrar com SDK do Mercado Pago                         │
│                                                              │
│  Proibições:                                                 │
│  ❌ NUNCA criar/atualizar Wallet diretamente                 │
│  ❌ NUNCA criar/atualizar WalletTransaction diretamente      │
│  ❌ NUNCA calcular saldo da carteira                         │
│                                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Orquestração via
                     │ walletService.creditFromGatewayTopup()
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVIÇO DE CARTEIRA                       │
│                   (lib/wallet/wallet.service.ts)             │
│                                                              │
│  Responsabilidades:                                          │
│  ✅ Creditar/debitar saldo (Wallet.availableCents)           │
│  ✅ Criar registros de WalletTransaction                     │
│  ✅ Calcular extrato e saldo                                 │
│  ✅ Garantir idempotência de créditos                        │
│                                                              │
│  Proibições:                                                 │
│  ❌ NUNCA chamar SDK do Mercado Pago                         │
│  ❌ NUNCA criar/atualizar PaymentTransaction                 │
│  ❌ NUNCA fazer integrações externas                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Fluxos de Negócio

### Fluxo 1: Recarga de Carteira via Gateway

```typescript
// 1. Frontend inicia pagamento
POST /api/mercadopago/create-payment
{
  amount: 100.00,
  method: 'pix',
  metadata: { type: 'wallet_topup', userId: 'usr_123' }
}

// 2. Módulo Mercado Pago cria PaymentTransaction
lib/mercadopago/payments.ts → createPaymentWithTracking()
  - Cria registro em PaymentTransaction (status: PENDING)
  - Chama SDK do Mercado Pago
  - Atualiza PaymentTransaction com dados do MP

// 3. Webhook do Mercado Pago confirma pagamento
POST /api/mercadopago/webhooks
lib/mercadopago/payments.ts → updatePaymentFromMercadoPago()
  - Atualiza status de PaymentTransaction (PAID)
  - Chama applyPaymentEffects()
    - Identifica tipo: wallet_topup
    - 🔥 ORQUESTRA para wallet service (não executa diretamente!)

// 4. Wallet Service aplica crédito
lib/wallet/wallet.service.ts → creditFromGatewayTopup()
  - Valida que PaymentTransaction está PAID
  - Verifica idempotência (já foi creditado?)
  - Cria WalletTransaction (status: CONFIRMED)
  - Atualiza Wallet.availableCents (+= amount)
  - Tudo dentro de transaction atômica
```

### Fluxo 2: Crédito Manual (Cortesia/Ajuste)

```typescript
// 1. Admin adiciona crédito manual
POST /api/admin/wallet/manual-credit
{
  userId: 'usr_123',
  amountCents: 5000,
  reason: 'Cortesia - Problema no envio #ABC',
  createdByAdminId: 'staff_456'
}

// 2. Wallet Service aplica crédito
lib/wallet/wallet.service.ts → manualCredit()
  - NÃO existe PaymentTransaction associado
  - Cria WalletTransaction com origin: 'manual'
  - Registra createdByAdminId no meta
  - Atualiza Wallet.availableCents
```

### Fluxo 3: Débito Manual (Ajuste)

```typescript
// 1. Admin remove crédito por ajuste
POST /api/admin/wallet/manual-debit
{
  userId: 'usr_123',
  amountCents: 1000,
  reason: 'Ajuste - Erro de duplicação',
  createdByAdminId: 'staff_456'
}

// 2. Wallet Service aplica débito
lib/wallet/wallet.service.ts → manualDebit()
  - Valida saldo suficiente
  - Cria WalletTransaction negativo
  - Atualiza Wallet.availableCents (-= amount)
```

## Estrutura de Arquivos

```
lib/
├── mercadopago/
│   ├── payments.ts          # ✅ Cria PaymentTransaction, orquestra para wallet service
│   ├── webhooks.ts          # ✅ Atualiza PaymentTransaction, orquestra efeitos
│   ├── client.ts            # ✅ Integração com SDK do Mercado Pago
│   └── types.ts             # ✅ Tipos do domínio de pagamentos
│
└── wallet/
    ├── wallet.service.ts    # ✅ Funções de domínio da carteira
    │                         #    - creditFromGatewayTopup()
    │                         #    - manualCredit()
    │                         #    - manualDebit()
    ├── period-summary.ts    # ✅ Cálculo de resumo mensal/período
    └── transaction-direction.ts  # ✅ Formatação de transações

app/api/
├── mercadopago/
│   ├── create-payment/      # ✅ Endpoint para criar pagamentos
│   └── webhooks/            # ✅ Endpoint para receber webhooks
│
└── wallet/
    ├── route.ts             # ✅ GET saldo + transações (usa WalletTransaction)
    ├── statement/
    │   ├── pdf/             # ✅ Gera PDF do extrato (usa WalletTransaction)
    │   └── download/        # ✅ Download CSV (usa WalletTransaction)
    └── topup/               # ✅ Inicia recarga via gateway
```

## Regras de Negócio

### Idempotência

O wallet service garante que **o mesmo pagamento nunca credita a carteira duas vezes**:

```typescript
// lib/wallet/wallet.service.ts
export async function creditFromGatewayTopup(params) {
  // Verifica se já existe WalletTransaction para este PaymentTransaction
  const existingWalletTx = await prisma.walletTransaction.findFirst({
    where: {
      meta: {
        path: ['paymentTransactionId'],
        equals: params.paymentTransactionId,
      },
      status: 'CONFIRMED',
    },
  });

  if (existingWalletTx) {
    // Retorna a transação existente (idempotência)
    return existingWalletTx;
  }

  // Cria nova transação...
}
```

### Atomicidade

Todas as operações de carteira usam transações do Prisma:

```typescript
// Garantia: ou TUDO acontece, ou NADA acontece
const [walletTx, updatedWallet] = await prisma.$transaction([
  prisma.walletTransaction.create({ ... }),
  prisma.wallet.update({ ... }),
]);
```

### Validações

**Crédito via Gateway:**
- PaymentTransaction deve existir
- PaymentTransaction deve estar `PAID`
- Não deve haver WalletTransaction já criado para este pagamento

**Crédito Manual:**
- Apenas admins podem executar
- Deve registrar `createdByAdminId` no meta
- Deve ter `reason` explicativo

**Débito Manual:**
- Deve validar saldo suficiente
- Não permite saldo negativo
- Registra `createdByAdminId` e `reason`

## Tipos de Transações

### WalletTransaction.type

```typescript
enum WalletTxType {
  TOPUP         // Recarga via gateway
  PURCHASE      // Compra de envio
  REFUND        // Reembolso de envio
  ADJUSTMENT    // Ajuste manual (crédito/débito)
  COMMISSION    // Comissão
  FEE           // Taxa
}
```

### WalletTransaction.meta

```typescript
// Topup via gateway
{
  paymentTransactionId: "ptx_abc123",
  externalId: "mp_123456789",
  currency: "BRL",
  source: "gateway_topup"
}

// Crédito/débito manual
{
  origin: "manual",
  createdByAdminId: "staff_456",
  reason: "Cortesia - Problema no envio #ABC"
}
```

## Consultas e Relatórios

### Saldo da Carteira

```typescript
// ✅ CORRETO: Usa Wallet.availableCents
const wallet = await prisma.wallet.findUnique({
  where: { userId },
});
const balance = wallet.availableCents; // Em centavos
```

### Extrato da Carteira

```typescript
// ✅ CORRETO: Usa WalletTransaction
const transactions = await prisma.walletTransaction.findMany({
  where: {
    walletId: wallet.id,
    status: 'CONFIRMED',
    confirmedAt: { gte: startDate, lte: endDate },
  },
  orderBy: { confirmedAt: 'desc' },
});
```

### Relatório de Pagamentos (Admin)

```typescript
// ✅ CORRETO: Usa PaymentTransaction para dados do gateway
const payments = await prisma.paymentTransaction.findMany({
  where: {
    status: 'PAID',
    paidAt: { gte: startDate, lte: endDate },
  },
  include: {
    gateway: true,
    user: true,
  },
});
```

## Testes e Validação

### Cenários de Teste

1. **Recarga duplicada (webhook chega 2x)**
   - ✅ Deve creditar apenas 1 vez (idempotência)
   - ✅ Segunda chamada retorna transação existente

2. **Crédito manual**
   - ✅ Deve criar WalletTransaction sem PaymentTransaction
   - ✅ Deve registrar admin que executou

3. **Débito sem saldo**
   - ✅ Deve rejeitar com erro
   - ✅ Não deve criar transação parcial

4. **Concorrência**
   - ✅ Dois webhooks simultâneos não devem duplicar crédito
   - ✅ Transaction do Prisma garante isolamento

## Migrações Futuras

### Dados Históricos

Se você tem dados antigos onde o módulo de pagamentos criava WalletTransaction diretamente:

```sql
-- Identificar transações criadas pelo módulo antigo
SELECT * FROM "WalletTransaction"
WHERE "meta"->>'source' IS NULL
  AND "createdAt" < '2024-XX-XX';

-- Adicionar metadata para rastreabilidade
UPDATE "WalletTransaction"
SET "meta" = jsonb_set("meta", '{migratedFrom}', '"legacy_payment_module"')
WHERE "meta"->>'source' IS NULL
  AND "createdAt" < '2024-XX-XX';
```

### Refatoração de Código Legado

Se encontrar código que ainda acessa Wallet/WalletTransaction diretamente:

```typescript
// ❌ ANTES (acoplado)
await prisma.walletTransaction.create({
  data: { ... },
});
await prisma.wallet.update({
  where: { userId },
  data: { availableCents: { increment: amount } },
});

// ✅ DEPOIS (desacoplado)
import * as walletService from '@/lib/wallet/wallet.service';

await walletService.creditFromGatewayTopup({
  userId,
  amountCents: amount,
  paymentTransactionId: txId,
});
```

## Checklist de Conformidade

Use este checklist ao adicionar novas funcionalidades:

### Ao adicionar novo tipo de pagamento:

- [ ] Cria apenas PaymentTransaction (não toca em Wallet)
- [ ] Define metadata.type claramente
- [ ] Orquestra efeitos via wallet service
- [ ] Garante idempotência

### Ao adicionar operação de carteira:

- [ ] Implementa função em wallet.service.ts
- [ ] Usa prisma.$transaction para atomicidade
- [ ] Valida saldo quando aplicável
- [ ] Registra metadata adequado (origin, reason, etc)
- [ ] NÃO chama APIs externas

### Ao criar relatórios:

- [ ] Usa WalletTransaction para extrato de usuário
- [ ] Usa PaymentTransaction para reconciliação de gateway
- [ ] Não mistura as duas fontes de dados

## Referências Rápidas

### Importações Corretas

```typescript
// Para criar/atualizar PaymentTransaction
import { createPaymentWithTracking } from '@/lib/mercadopago/payments';

// Para operações de carteira
import * as walletService from '@/lib/wallet/wallet.service';
import { getOrCreateWallet, centsToReais } from '@/lib/wallet/wallet.service';

// Para cálculos de período
import { calculatePeriodSummary, getCurrentMonthRange } from '@/lib/wallet/period-summary';
```

### Funções Principais

| Função | Módulo | Quando Usar |
|--------|--------|-------------|
| `createPaymentWithTracking()` | mercadopago/payments | Criar novo pagamento no gateway |
| `updatePaymentFromMercadoPago()` | mercadopago/payments | Atualizar status via webhook |
| `creditFromGatewayTopup()` | wallet/wallet.service | Creditar após pagamento confirmado |
| `manualCredit()` | wallet/wallet.service | Crédito manual (cortesia/ajuste) |
| `manualDebit()` | wallet/wallet.service | Débito manual (ajuste) |
| `getOrCreateWallet()` | wallet/wallet.service | Buscar/criar carteira do usuário |

---

**Última atualização:** 2024-11-22
**Mantido por:** Equipe de Engenharia
