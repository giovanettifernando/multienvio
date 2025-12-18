# Refatoração Completa: Carteira e Extrato

## Resumo

Esta documentação descreve a refatoração completa do sistema de carteira e extrato, incluindo:

- ✅ Nova estrutura de dados com separação clara de créditos e débitos
- ✅ Resumo mensal na página principal da carteira
- ✅ Tela de extrato com filtros de data e busca
- ✅ Geração de extrato em PDF/HTML para impressão
- ✅ Interface mobile-responsive
- ✅ Remoção da coluna Status (apenas transações confirmadas)

---

## 1. Mudanças no Backend

### 1.1 Bibliotecas Auxiliares Criadas

#### `/lib/wallet/transaction-direction.ts`

Determina a direção da transação (crédito ou débito) e formata valores:

```typescript
export type TransactionDirection = 'credit' | 'debit';

// Regras de negócio:
// - TOPUP, REFUND → sempre crédito
// - PURCHASE, WITHDRAW → sempre débito
// - ADJUSTMENT → baseado no sinal do valor
export function getTransactionDirection(
  type: WalletTxType,
  amountCents: number
): TransactionDirection

// Formata com sinal: "+ R$ 100,00" ou "- R$ 50,00"
export function formatTransactionAmount(
  amountCents: number,
  direction: TransactionDirection
): string
```

#### `/lib/wallet/period-summary.ts`

Calcula totais para qualquer período de tempo:

```typescript
export function calculatePeriodSummary(
  transactions: WalletTransaction[],
  periodStart: Date,
  periodEnd: Date
): PeriodSummary

// Retorna:
// - totalCredits: soma de todos os créditos (em reais)
// - totalDebits: soma de todos os débitos (em reais)
// - netAmount: saldo do período (créditos - débitos)
// - transactionCount: número de transações confirmadas
```

#### `/types/wallet-statement.ts`

Novos tipos TypeScript para as respostas da API:

```typescript
// DTO de transação individual
export interface WalletTransactionDTO {
  id: string;
  type: WalletTxType;
  typeLabel: string; // "Recarga", "Compra", etc.
  status: WalletTxStatus;
  amountCents: number;
  amountReais: number;
  direction: TransactionDirection; // 'credit' | 'debit'
  formattedAmount: string; // "+ R$ 100,00"
  title: string | null;
  description: string | null;
  referenceId: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

// Resumo de um período
export interface PeriodSummary {
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  totalCredits: number; // em reais
  totalDebits: number; // em reais
  netAmount: number; // em reais
  transactionCount: number;
}

// Resposta do endpoint principal da carteira
export interface WalletBalanceResponse {
  balance: {
    availableReais: number;
    availableCents: number;
    pendingReais: number;
    pendingCents: number;
  };
  monthlySummary: PeriodSummary;
  latestTransactions: WalletTransactionDTO[];
}

// Resposta do endpoint de transações (com filtros)
export interface StatementResponse {
  transactions: WalletTransactionDTO[];
  summary: PeriodSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
```

### 1.2 Endpoints Refatorados/Criados

#### `GET /api/wallet`

**Antes:** Retornava apenas saldo disponível e pendente.

**Depois:** Retorna saldo + resumo mensal + últimas 10 transações.

```typescript
// Resposta:
{
  balance: {
    availableReais: 500.00,
    availableCents: 50000,
    pendingReais: 0,
    pendingCents: 0
  },
  monthlySummary: {
    periodStart: "2025-11-01T00:00:00.000Z",
    periodEnd: "2025-11-30T23:59:59.999Z",
    totalCredits: 1000.00,
    totalDebits: 500.00,
    netAmount: 500.00,
    transactionCount: 15
  },
  latestTransactions: [
    {
      id: "tx_123",
      typeLabel: "Compra",
      direction: "debit",
      formattedAmount: "- R$ 25,50",
      description: "Etiqueta #123",
      confirmedAt: "2025-11-15T10:30:00.000Z",
      // ...
    }
  ]
}
```

#### `GET /api/wallet/transactions`

**Antes:** Retornava lista simples de transações com limite fixo.

**Depois:** Suporta filtros, busca, paginação e retorna resumo do período.

**Query Parameters:**
- `dateFrom` (opcional): Data inicial (formato: YYYY-MM-DD, padrão: 30 dias atrás)
- `dateTo` (opcional): Data final (formato: YYYY-MM-DD, padrão: hoje)
- `search` (opcional): Busca por descrição, tipo ou referência
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 20)

**Exemplo:**
```
GET /api/wallet/transactions?dateFrom=2025-11-01&dateTo=2025-11-15&search=etiqueta&page=1&limit=20
```

**Resposta:**
```typescript
{
  transactions: WalletTransactionDTO[],
  summary: {
    periodStart: "2025-11-01T00:00:00.000Z",
    periodEnd: "2025-11-15T23:59:59.999Z",
    totalCredits: 500.00,
    totalDebits: 250.00,
    netAmount: 250.00,
    transactionCount: 8
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 8,
    hasMore: false
  }
}
```

**Regras de Negócio:**
- Apenas transações com status `CONFIRMED` são retornadas
- O resumo do período considera todas as transações confirmadas no intervalo
- A busca é case-insensitive e procura em: `title`, `type`, `referenceId`

#### `GET /api/wallet/statement/pdf`

**Novo endpoint** para gerar HTML do extrato para impressão.

**Query Parameters:** (mesmos da rota `/api/wallet/transactions`)
- `dateFrom`, `dateTo`, `search`

**Resposta:** HTML formatado pronto para impressão, incluindo:
- Logo "Envio Legal"
- Título com período
- Informações do usuário (nome, email)
- Tabela de transações
- Totais do período
- Estilos CSS para impressão

**Uso:** Carregado em `<iframe>` no modal de visualização de PDF.

---

## 2. Mudanças no Frontend

### 2.1 Hooks Atualizados

#### `/hooks/useWallet.ts`

```typescript
// Mudou o tipo de retorno:
// ANTES: useQuery<Wallet>
// DEPOIS: useQuery<WalletBalanceResponse>

export function useWallet() {
  return useQuery<WalletBalanceResponse>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const response = await fetch("/api/wallet");
      if (!response.ok) {
        throw new Error("Falha ao carregar carteira");
      }
      return response.json();
    },
  });
}
```

**Impacto:** Todos os componentes que usam `useWallet()` precisam acessar:
- `data.balance.availableReais` ao invés de `data.available`
- `data.monthlySummary` para resumo mensal
- `data.latestTransactions` para últimas transações

#### `/hooks/useWalletTransactions.ts`

```typescript
// Mudou a assinatura de:
// useWalletTransactions(limit: number)
// Para:
// useWalletTransactions(filters: WalletTransactionsFilters)

export interface WalletTransactionsFilters {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useWalletTransactions(filters: WalletTransactionsFilters = {})

// Retorna: useQuery<StatementResponse>
```

**Uso:**
```typescript
// Antigo:
const { data } = useWalletTransactions(30);

// Novo:
const { data } = useWalletTransactions({ limit: 30 });
const { data } = useWalletTransactions({
  dateFrom: '2025-11-01',
  dateTo: '2025-11-30',
  search: 'etiqueta',
  page: 1,
  limit: 20
});
```

### 2.2 Componentes Criados

#### `/components/wallet/MonthlySummaryCard.tsx`

Exibe resumo mensal com estatísticas visuais (verde para créditos, vermelho para débitos).

**Props:**
```typescript
interface MonthlySummaryCardProps {
  summary: PeriodSummary;
  loading?: boolean;
}
```

**Visualização:**
- 3 colunas: Créditos | Débitos | Saldo do Período
- Ícones de setas (↑ créditos, ↓ débitos)
- Contador de transações no rodapé
- Responsive: colunas empilham em mobile

#### `/components/wallet/PeriodSummaryCard.tsx`

Similar ao MonthlySummaryCard, mas exibe o período filtrado (usado no extrato).

**Diferença:** Mostra datas de início e fim do período no subtítulo.

#### `/components/wallet/TransactionsTable.tsx`

Tabela simples de transações (usada na página principal da carteira).

**Características:**
- Sem paginação (mostra apenas as 10 últimas)
- 4 colunas: Data | Tipo | Valor | Descrição
- Valores coloridos: verde (+) para créditos, vermelho (-) para débitos
- **SEM coluna de Status** (apenas transações confirmadas)

#### `/components/wallet/StatementTable.tsx`

Tabela de transações com paginação (usada no extrato).

**Props:**
```typescript
interface StatementTableProps {
  transactions: WalletTransactionDTO[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
    showSizeChanger?: boolean;
    showTotal?: (total: number) => string;
  };
}
```

**Características:**
- Suporta paginação customizável
- Scroll horizontal em mobile (`scroll={{ x: 800 }}`)
- Mesmo layout de colunas que TransactionsTable

#### `/components/wallet/StatementPDFModal.tsx`

Modal para visualizar e imprimir/baixar extrato.

**Props:**
```typescript
interface StatementPDFModalProps {
  open: boolean;
  onClose: () => void;
  dateFrom: string;
  dateTo: string;
  search?: string;
}
```

**Funcionalidades:**
- Carrega HTML do endpoint `/api/wallet/statement/pdf` em `<iframe>`
- Botão "Imprimir": chama `window.print()` do iframe
- Botão "Baixar HTML": faz download do arquivo HTML
- Botão "Fechar": fecha o modal
- Modal ocupa 90% da largura (máx: 1200px)
- Iframe ocupa altura disponível (calc(100vh - 200px))

### 2.3 Páginas Refatoradas

#### `/app/(dashboard)/carteira/page.tsx`

**Layout:**
```
┌─────────────────────────────────────┐
│ Alert (se não tem cartões)          │
└─────────────────────────────────────┘
┌──────────────────┬──────────────────┐
│  BalanceCard     │ MonthlySummaryCard│
│  (saldo + botão) │  (resumo mensal) │
└──────────────────┴──────────────────┘
┌─────────────────────────────────────┐
│ Card: "Últimas transações"          │
│ [Ver extrato completo →]            │
│                                     │
│ TransactionsTable                   │
│ (10 últimas transações)             │
└─────────────────────────────────────┘
```

**Responsividade:**
- Desktop (lg): BalanceCard e MonthlySummaryCard lado a lado (50/50)
- Mobile (xs): Cards empilhados verticalmente

**Mudanças principais:**
- ✅ Usa novo formato de dados (`WalletBalanceResponse`)
- ✅ Exibe resumo mensal automaticamente
- ✅ Transações coloridas sem coluna de Status

#### `/app/(dashboard)/carteira/extrato/page.tsx`

**Layout:**
```
┌─────────────────────────────────────┐
│ Card: Filtros                       │
│ ┌──────────────┬──────────────────┐ │
│ │ DateRangePicker │ SearchInput   │ │
│ └──────────────┴──────────────────┘ │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ PeriodSummaryCard                   │
│ (totais do período filtrado)        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Card: "Transações"                  │
│              [Imprimir / PDF] botão │
│                                     │
│ StatementTable                      │
│ (transações com paginação)          │
│ Total: X transações                 │
└─────────────────────────────────────┘
```

**Funcionalidades:**
- **Filtro de data**: Padrão últimos 30 dias
- **Busca**: Filtra por descrição, tipo ou referência
- **Paginação**: 20 itens por página
- **Resumo dinâmico**: Atualiza conforme filtros
- **Botão PDF**: Abre modal com visualização

**Estado gerenciado:**
```typescript
const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
  dayjs().subtract(30, 'days'),
  dayjs(),
]);
const [search, setSearch] = useState<string>("");
const [page, setPage] = useState<number>(1);
const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);
```

**Integração com hook:**
```typescript
const { data, isLoading } = useWalletTransactions({
  dateFrom: dateRange[0].format('YYYY-MM-DD'),
  dateTo: dateRange[1].format('YYYY-MM-DD'),
  search: search || undefined,
  page,
  limit: 20,
});
```

### 2.4 Componentes Corrigidos

#### `/components/dashboard/WalletCard.tsx`

**Mudanças:**
- ✅ Usa novo formato: `wallet.balance.availableReais`
- ✅ Hook atualizado: `useWalletTransactions({ limit: 30 })`
- ✅ Usa `confirmedAt` ao invés de `createdAt`
- ✅ Filtra débitos por `direction === 'debit'` ao invés de `amountCents < 0`

---

## 3. Fluxo de Dados

### 3.1 Página Principal da Carteira

```
┌──────────────────────────────────────┐
│ useWallet() hook                     │
│ ↓                                    │
│ GET /api/wallet                      │
│ ↓                                    │
│ WalletBalanceResponse {              │
│   balance: { ... },                  │
│   monthlySummary: PeriodSummary,     │
│   latestTransactions: [...10]        │
│ }                                    │
└──────────────────────────────────────┘
         ↓                    ↓
┌─────────────────┐  ┌─────────────────┐
│ BalanceCard     │  │MonthlySummaryCard│
└─────────────────┘  └─────────────────┘
         ↓
┌─────────────────────────────────────┐
│ TransactionsTable                   │
│ (últimas 10 transações)             │
└─────────────────────────────────────┘
```

### 3.2 Página de Extrato

```
┌──────────────────────────────────────┐
│ useWalletTransactions(filters) hook  │
│ ↓                                    │
│ GET /api/wallet/transactions?...     │
│ ↓                                    │
│ StatementResponse {                  │
│   transactions: [...20],             │
│   summary: PeriodSummary,            │
│   pagination: { ... }                │
│ }                                    │
└──────────────────────────────────────┘
         ↓                    ↓
┌─────────────────┐  ┌─────────────────┐
│PeriodSummaryCard│  │ StatementTable  │
└─────────────────┘  └─────────────────┘
```

### 3.3 Geração de PDF

```
┌──────────────────────────────────────┐
│ Usuário clica "Imprimir / PDF"       │
│ ↓                                    │
│ StatementPDFModal abre               │
│ ↓                                    │
│ <iframe src="/api/wallet/statement/  │
│         pdf?dateFrom=...&dateTo=...">│
│ ↓                                    │
│ GET /api/wallet/statement/pdf        │
│ ↓                                    │
│ Retorna HTML formatado               │
│ ↓                                    │
│ Usuário pode:                        │
│ - Visualizar no iframe               │
│ - Clicar "Imprimir" → window.print() │
│ - Clicar "Baixar HTML" → download    │
└──────────────────────────────────────┘
```

---

## 4. Regras de Negócio

### 4.1 Determinação de Crédito/Débito

| Tipo de Transação | Direção  | Cor     | Formato        |
|-------------------|----------|---------|----------------|
| TOPUP             | credit   | Verde   | + R$ X,XX      |
| REFUND            | credit   | Verde   | + R$ X,XX      |
| PURCHASE          | debit    | Vermelho| - R$ X,XX      |
| WITHDRAW          | debit    | Vermelho| - R$ X,XX      |
| ADJUSTMENT        | baseado no sinal do valor | Verde/Vermelho | ± R$ X,XX |

### 4.2 Filtragem de Transações

**Apenas transações CONFIRMADAS são exibidas:**
- Status `PENDING`, `FAILED`, `CANCELED` são ignorados
- Coluna de Status removida da interface

**Datas:**
- `confirmedAt` é usado para exibição e filtros
- Formato de exibição: `DD/MM/YYYY HH:mm`

### 4.3 Resumos de Período

**Resumo Mensal (página principal):**
- Período: primeiro dia às 00:00 até último dia às 23:59:59 do mês atual
- Calculado do lado do servidor

**Resumo Filtrado (extrato):**
- Período: conforme filtros do usuário
- Padrão: últimos 30 dias
- Recalculado a cada mudança de filtro

**Cálculo:**
```typescript
totalCredits = soma de todos os valores positivos (em reais)
totalDebits = soma de todos os valores negativos (em reais)
netAmount = totalCredits - totalDebits
```

---

## 5. Considerações de UX

### 5.1 Cores e Ícones

- **Verde (#52c41a):** Créditos, saldo positivo, ícone ↑
- **Vermelho (#ff4d4f):** Débitos, saldo negativo, ícone ↓
- **Azul (#1890ff):** Saldo disponível (destaque)

### 5.2 Responsividade

**Breakpoints (Ant Design):**
- `xs`: < 576px (mobile)
- `sm`: ≥ 576px
- `md`: ≥ 768px
- `lg`: ≥ 992px (desktop)

**Comportamentos:**
- Cartões empilham verticalmente em mobile
- Tabelas ganham scroll horizontal em mobile
- Filtros ocupam linha inteira em mobile (xs: 24), metade em desktop (md: 12)

### 5.3 Estados de Loading

- Cards exibem `<Skeleton>` durante carregamento
- Tabelas mostram spinner centralizado
- Botões desabilitam durante operações

### 5.4 Mensagens de Erro/Vazio

- Tabela vazia: `<Empty description="Nenhuma transação encontrada" />`
- Erro de API: `message.error()` com mensagem descritiva

---

## 6. Testes Sugeridos

### 6.1 Testes Manuais

**Página Principal da Carteira:**
- [ ] Saldo disponível é exibido corretamente
- [ ] Resumo mensal mostra créditos, débitos e saldo líquido
- [ ] Últimas 10 transações aparecem sem coluna de Status
- [ ] Valores em verde (+) para créditos, vermelho (-) para débitos
- [ ] Botão "Adicionar saldo" abre modal
- [ ] Link "Ver extrato completo" navega para `/carteira/extrato`
- [ ] Layout responsivo: cards lado a lado (desktop) e empilhados (mobile)

**Página de Extrato:**
- [ ] Filtro de data padrão: últimos 30 dias
- [ ] Alteração de datas recarrega transações
- [ ] Busca filtra por descrição, tipo ou referência
- [ ] Paginação funciona corretamente
- [ ] Resumo do período atualiza com filtros
- [ ] Botão "Imprimir / PDF" desabilitado quando sem transações
- [ ] Botão "Imprimir / PDF" abre modal com visualização

**Modal de PDF:**
- [ ] Iframe carrega HTML do extrato
- [ ] Botão "Imprimir" abre diálogo de impressão do navegador
- [ ] Botão "Baixar HTML" faz download do arquivo
- [ ] Botão "Fechar" fecha o modal
- [ ] PDF respeita filtros da página (datas, busca)

### 6.2 Testes de API

**GET /api/wallet:**
```bash
curl http://localhost:3000/api/wallet
# Deve retornar: { balance, monthlySummary, latestTransactions }
```

**GET /api/wallet/transactions:**
```bash
# Sem filtros (padrão: últimos 30 dias)
curl http://localhost:3000/api/wallet/transactions

# Com filtros de data
curl "http://localhost:3000/api/wallet/transactions?dateFrom=2025-11-01&dateTo=2025-11-15"

# Com busca
curl "http://localhost:3000/api/wallet/transactions?search=etiqueta"

# Com paginação
curl "http://localhost:3000/api/wallet/transactions?page=2&limit=10"
```

**GET /api/wallet/statement/pdf:**
```bash
# Abrir no navegador:
http://localhost:3000/api/wallet/statement/pdf?dateFrom=2025-11-01&dateTo=2025-11-15
```

---

## 7. Checklist de Implementação

- [x] Criar `/lib/wallet/transaction-direction.ts`
- [x] Criar `/lib/wallet/period-summary.ts`
- [x] Criar `/types/wallet-statement.ts`
- [x] Refatorar `GET /api/wallet` (adicionar resumo mensal + últimas transações)
- [x] Refatorar `GET /api/wallet/transactions` (adicionar filtros, busca, paginação)
- [x] Criar `GET /api/wallet/statement/pdf`
- [x] Atualizar `/hooks/useWallet.ts` (tipo de retorno)
- [x] Atualizar `/hooks/useWalletTransactions.ts` (aceitar filtros)
- [x] Criar `/components/wallet/MonthlySummaryCard.tsx`
- [x] Criar `/components/wallet/PeriodSummaryCard.tsx`
- [x] Criar `/components/wallet/TransactionsTable.tsx`
- [x] Criar `/components/wallet/StatementTable.tsx`
- [x] Criar `/components/wallet/StatementPDFModal.tsx`
- [x] Refatorar `/app/(dashboard)/carteira/page.tsx`
- [x] Refatorar `/app/(dashboard)/carteira/extrato/page.tsx`
- [x] Corrigir `/components/wallet/BalanceCard.tsx`
- [x] Corrigir `/components/dashboard/WalletCard.tsx`
- [x] Verificar 0 erros TypeScript (`npx tsc --noEmit`)

---

## 8. Melhorias Futuras (Opcional)

### 8.1 Funcionalidades

- [ ] Exportar extrato em CSV
- [ ] Gerar PDF real (usando biblioteca como jsPDF ou Puppeteer)
- [ ] Filtro por tipo de transação (dropdown com TOPUP, PURCHASE, etc.)
- [ ] Gráficos de evolução do saldo ao longo do tempo
- [ ] Notificações de saldo baixo (push/email)

### 8.2 Performance

- [ ] Implementar cache do resumo mensal (Redis)
- [ ] Adicionar índices no banco de dados para filtros de data
- [ ] Paginação server-side com cursor (ao invés de offset)

### 8.3 UX

- [ ] Animações de transição entre páginas
- [ ] Destacar transações recentes (< 24h)
- [ ] Modo escuro
- [ ] Atalhos de teclado para navegação

---

## 9. Links Úteis

- [Ant Design - Table](https://ant.design/components/table)
- [Ant Design - DatePicker](https://ant.design/components/date-picker)
- [Ant Design - Modal](https://ant.design/components/modal)
- [TanStack Query (React Query)](https://tanstack.com/query/latest)
- [Day.js](https://day.js.org/)
- [Prisma Docs](https://www.prisma.io/docs)

---

**Documentação criada em:** 2025-11-18
**Versão do projeto:** v17-11
**Status:** ✅ Implementação completa
