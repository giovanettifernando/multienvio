# Sistema de Integrações - Documentação Backend

## Visão Geral

Sistema completo de gerenciamento de integrações com transportadoras e gateways de pagamento para a plataforma Envio Legal. O sistema fornece infraestrutura para cotações, criação de pedidos/etiquetas, rastreamento, processamento de pagamentos, webhooks, e monitoramento de saúde.

**Data**: 2025-11-03
**Timezone**: America/Fortaleza (UTC-3)
**Moeda**: BRL (Real Brasileiro)

---

## Arquitetura do Sistema

### Componentes Principais

1. **Módulo de Transportadoras** (`carriers`)
   - Gerenciamento de transportadoras (CRUD)
   - Serviços e catálogo de modalidades
   - Endpoints e mapeamento de campos
   - Credenciais e autenticação
   - Regras tarifárias
   - Processamento de webhooks de tracking
   - Monitoramento de saúde

2. **Módulo de Pagamentos** (`payments`)
   - Gerenciamento de gateways (CRUD)
   - Credenciais e métodos habilitados
   - Transações, autorizações, capturas
   - Refunds e chargebacks
   - Ledger contábil
   - Processamento de webhooks
   - Reconciliação

3. **Sistema de Webhooks** (`webhooks`)
   - Recebimento e validação
   - Fila de processamento
   - Retentativas com backoff exponencial
   - Idempotência

4. **Sistema de Monitoramento** (`health`)
   - Health checks periódicos
   - Métricas de latência e taxa de sucesso
   - Alertas de degradação

---

## Modelo de Dados

### Transportadoras

#### Carrier
Entidade principal da transportadora.

**Campos**:
- `id`: CUID único
- `name`: Nome da transportadora (ex: "Correios", "Jadlog")
- `slug`: Identificador único (ex: "correios", "jadlog")
- `status`: ACTIVE | INACTIVE | ERROR | TESTING
- `environment`: SANDBOX | PRODUCTION
- `baseUrl`: URL base da API
- `timeout`: Timeout em ms (padrão: 30000)
- `maxRetries`: Máximo de tentativas (padrão: 3)
- `logoUrl`: URL do logo
- `description`: Descrição

**Relações**:
- `services[]`: Serviços oferecidos
- `endpoints[]`: Endpoints configurados
- `credentials[]`: Credenciais de autenticação
- `pricingRules[]`: Regras tarifárias
- `webhooks[]`: Webhooks recebidos
- `healthChecks[]`: Histórico de health checks
- `apiCalls[]`: Log de chamadas à API

**Indexes**:
- `[slug]`: Busca por slug
- `[status]`: Filtragem por status

#### CarrierService
Serviços/modalidades oferecidos pela transportadora.

**Campos**:
- `serviceId`: ID interno (ex: "pac", "sedex", "package")
- `name`: Nome do serviço
- `type`: express | economic | reverse
- `isActive`: Serviço ativo/inativo
- `minDays`, `maxDays`: Prazo mínimo/máximo
- `requiresInsurance`: Exige seguro
- `metadata`: JSON com dados adicionais

**Constraint**: `UNIQUE(carrierId, serviceId)`

#### CarrierEndpoint
Configuração de endpoints por operação.

**Operações Suportadas**:
- `quote`: Cotação de preço/prazo
- `create_order`: Criação de pedido/etiqueta
- `cancel`: Cancelamento
- `label`: Geração de etiqueta
- `tracking`: Rastreamento

**Campos**:
- `operation`: Tipo de operação
- `method`: GET | POST | PUT | DELETE | PATCH
- `path`: Caminho do endpoint
- `timeout`: Override de timeout
- `retryable`: Se permite retry
- `requestMapping`: Mapeamento de request
- `responseMapping`: Mapeamento de response
- `lastTestedAt`: Última validação

**Constraint**: `UNIQUE(carrierId, operation)`

#### CarrierCredential
Credenciais de autenticação por ambiente.

**Tipos de Auth Suportados**:
- `API_KEY`: Chave de API simples
- `OAUTH2`: OAuth2 com client credentials
- `BASIC`: Basic authentication
- `BEARER`: Token Bearer
- `SIGNED_HEADER`: Header assinado customizado
- `CUSTOM`: Implementação customizada

**Campos (Encrypted)**:
- `apiKey`
- `clientId`, `clientSecret`
- `username`, `password`
- `token`
- `accessToken`, `refreshToken`, `expiresAt`
- `customHeaders`: JSON com headers customizados

**Index**: `[carrierId, environment, isActive]`

#### CarrierPricingRule
Regras tarifárias para cálculo de preços.

**Campos de Filtro**:
- `serviceId`: Serviço específico (null = geral)
- `originStates`, `destStates`: UFs (comma-separated)
- `minWeight`, `maxWeight`: Faixa de peso

**Campos de Preço**:
- `basePriceCents`: Preço base
- `pricePerKg`: Preço por kg adicional
- `insurancePercent`: % de seguro
- `additionalFees`: JSON com taxas adicionais
- `priority`: Ordem de aplicação (menor = primeiro)

**Index**: `[carrierId, isActive, priority]`

#### CarrierWebhook
Webhooks recebidos de transportadoras (tracking updates).

**Campos**:
- `eventType`: tracking_update | delivery | exception | etc
- `externalId`: Código de rastreamento
- `payload`: JSON com dados brutos
- `signature`: Assinatura para validação
- `status`: pending | processed | failed | retrying
- `retryCount`, `maxRetries`, `nextRetryAt`
- `errorMessage`

**Processamento**:
1. Validação de assinatura
2. Processamento (atualização de status)
3. Retry com backoff exponencial se falhar
4. Idempotência (não reprocessa eventos duplicados)

**Indexes**:
- `[carrierId, status, nextRetryAt]`: Fila de reprocessamento
- `[externalId]`: Busca por tracking
- `[createdAt]`: Histórico

#### CarrierHealthCheck
Histórico de health checks.

**Campos**:
- `status`: HEALTHY | DEGRADED | DOWN | UNKNOWN
- `responseTime`: Tempo de resposta em ms
- `successRate`: Taxa de sucesso (últimas 24h)
- `avgLatency`: Latência média
- `errorMessage`: Mensagem de erro
- `checkedAt`: Timestamp

**Index**: `[carrierId, checkedAt]`

#### CarrierApiCall
Log de chamadas à API da transportadora.

**Campos**:
- `operation`, `method`, `endpoint`
- `requestBody`, `responseBody`
- `statusCode`
- `startedAt`, `completedAt`, `duration`
- `success`, `errorMessage`

**Indexes**:
- `[carrierId, operation, startedAt]`
- `[success, startedAt]`

**Retenção**: 30 dias (limpeza automática)

---

### Gateways de Pagamento

#### PaymentGateway
Gateway de pagamento (ex: Stripe, PagSeguro).

**Campos**:
- `name`, `slug`
- `status`, `environment`
- `baseUrl`, `timeout`
- `enabledMethods[]`: Array de métodos habilitados
  - CREDIT_CARD, DEBIT_CARD, PIX, BOLETO, WALLET

**Relações**:
- `credentials[]`: Credenciais por ambiente
- `endpoints[]`: Endpoints por operação
- `transactions[]`: Transações processadas
- `webhooks[]`: Webhooks recebidos
- `healthChecks[]`: Health checks

#### PaymentCredential
Credenciais do gateway por ambiente.

**Campos (Encrypted)**:
- `merchantId`: ID da conta merchant
- `apiKey`, `publicKey`, `secretKey`
- `clientId`, `clientSecret`
- `accessToken`, `refreshToken`, `expiresAt`

**Index**: `[gatewayId, environment, isActive]`

#### PaymentEndpoint
Endpoints por operação de pagamento.

**Operações**:
- `charge`: Cobrança direta (1-step)
- `authorize`: Autorização (2-step, parte 1)
- `capture`: Captura (2-step, parte 2)
- `refund`: Reembolso
- `cancel`: Cancelamento
- `check_status`: Consulta de status
- `create_pix`: Gerar QR Code Pix
- `create_boleto`: Gerar boleto

**Constraint**: `UNIQUE(gatewayId, operation)`

#### PaymentTransaction
Transação de pagamento.

**Campos Principais**:
- `externalId`: ID no gateway
- `referenceId`: ID interno (único)
- `userId`: Usuário (opcional)
- `method`: Método utilizado
- `status`: PENDING | AUTHORIZED | CAPTURED | PAID | REFUNDED | CHARGEBACK | CANCELED | FAILED

**Valores (em centavos)**:
- `amountCents`: Valor total
- `feeCents`: Taxa do gateway
- `netCents`: Valor líquido (amount - fee)

**Dados por Método**:
- Cartão: `cardBrand`, `cardLast4`
- Pix: `pixKey`, `pixQrCode`
- Boleto: `boletoUrl`, `boletoBarcode`

**Timestamps**:
- `createdAt`, `updatedAt`
- `authorizedAt`, `capturedAt`, `paidAt`, `refundedAt`

**Relações**:
- `refunds[]`: Reembolsos
- `chargebacks[]`: Chargebacks
- `ledgerEntries[]`: Lançamentos contábeis

**Indexes**:
- `[gatewayId, status, createdAt]`
- `[userId, status]`
- `[referenceId]` (unique)
- `[externalId]`

#### PaymentRefund
Reembolso de transação.

**Campos**:
- `transactionId`: Transação original
- `externalId`: ID do refund no gateway
- `amountCents`: Valor reembolsado
- `reason`: Motivo
- `status`: pending | completed | failed
- `completedAt`

**Regra**: Sum(refunds.amountCents) <= transaction.amountCents

#### PaymentChargeback
Chargeback recebido.

**Campos**:
- `transactionId`, `externalId`
- `reason`: Motivo do chargeback
- `amountCents`
- `status`: received | accepted | contested | won | lost
- `receivedAt`, `resolvedAt`

#### PaymentWebhook
Webhooks de eventos de pagamento.

**Event Types**:
- `payment.authorized`
- `payment.captured`
- `payment.paid`
- `payment.refunded`
- `payment.chargeback`
- `payment.failed`

**Processamento**: Igual a CarrierWebhook (fila, retry, idempotência)

#### LedgerEntry
Razão contábil (ledger).

**Tipos**:
- `CHARGE`: Cobrança (débito do cliente)
- `REFUND`: Reembolso (crédito ao cliente)
- `CHARGEBACK`: Chargeback (débito da plataforma)
- `FEE`: Taxa do gateway (débito da plataforma)
- `PAYOUT`: Repasse a parceiro (débito da plataforma)
- `ADJUSTMENT`: Ajuste manual

**Campos**:
- `transactionId`: Transação relacionada (opcional)
- `type`: Tipo de lançamento
- `amountCents`: Valor (positivo = crédito, negativo = débito)
- `accountType`: platform | user_wallet | partner_payout
- `accountId`: ID da conta
- `description`: Descrição do lançamento
- `metadata`: Dados adicionais

**Indexes**:
- `[accountType, accountId, createdAt]`: Extrato por conta
- `[transactionId]`: Lançamentos de uma transação
- `[type, createdAt]`: Por tipo

**Double-Entry Bookkeeping**: Cada transação gera múltiplos lançamentos (débito + crédito = 0)

---

## Camada de Validação

### Transportadoras

Arquivo: `lib/validation/integrations-carriers.ts`

**Schemas Principais**:
- `createCarrierSchema`: Validação de criação de transportadora
- `createCarrierServiceSchema`: Validação de serviço
- `createCarrierEndpointSchema`: Validação de endpoint
- `createCarrierCredentialSchema`: Validação de credenciais
- `createCarrierPricingRuleSchema`: Validação de regra tarifária
- `processCarrierWebhookSchema`: Validação de webhook

**Regras de Negócio**:
```typescript
validateCarrierRules.validateCredentialFields(authType, data)
// Valida se campos obrigatórios estão presentes por tipo de auth

validateCarrierRules.validatePricingRule(rule)
// Valida consistência de regra (min <= max, etc)

validateCarrierRules.shouldRetryWebhook(retryCount, maxRetries)
// Decide se webhook deve ser reprocessado

validateCarrierRules.calculateNextRetry(retryCount)
// Calcula próximo horário com backoff exponencial
```

**Masking**:
```typescript
maskApiKey(apiKey) // "abc1****xyz9"
maskSecret(secret) // "****** (hidden)"
maskCredentials(credential) // Mascara todos campos sensíveis
```

### Pagamentos

Arquivo: `lib/validation/integrations-payments.ts`

**Schemas Principais**:
- `createPaymentGatewaySchema`
- `createPaymentCredentialSchema`
- `createPaymentTransactionSchema`
- `createPaymentRefundSchema`
- `createPaymentChargebackSchema`
- `createLedgerEntrySchema`
- `processPaymentWebhookSchema`

**Regras de Negócio**:
```typescript
validatePaymentRules.isMethodEnabled(enabledMethods, method)
validatePaymentRules.canRefund(status)
validatePaymentRules.canCancel(status)
validatePaymentRules.validateRefundAmount(refund, transaction, alreadyRefunded)
validatePaymentRules.calculateNetAmount(amount, fee)
```

**Helpers**:
```typescript
formatCurrency(cents) // R$ 123,45
formatDateForTimezone(date) // 03/11/2025 10:30:45 (America/Fortaleza)
maskCardNumber(number) // "**** **** **** 1234"
maskPaymentCredentials(credential)
```

---

## Camada de Serviço

### Estrutura de Serviços

```
lib/integrations/
├── carriers/
│   ├── carrier.service.ts          # CRUD de transportadoras
│   ├── carrier-service.service.ts  # CRUD de serviços
│   ├── carrier-endpoint.service.ts # CRUD de endpoints
│   ├── carrier-credential.service.ts # CRUD de credenciais
│   ├── carrier-pricing.service.ts  # CRUD de regras tarifárias
│   ├── carrier-webhook.service.ts  # Processamento de webhooks
│   ├── carrier-health.service.ts   # Health checks
│   └── carrier-api.service.ts      # Chamadas à API externa
├── payments/
│   ├── gateway.service.ts          # CRUD de gateways
│   ├── payment-credential.service.ts
│   ├── payment-endpoint.service.ts
│   ├── transaction.service.ts      # Transações
│   ├── refund.service.ts           # Reembolsos
│   ├── chargeback.service.ts       # Chargebacks
│   ├── ledger.service.ts           # Lançamentos contábeis
│   ├── payment-webhook.service.ts  # Processamento de webhooks
│   └── payment-health.service.ts   # Health checks
└── shared/
    ├── encryption.service.ts       # Criptografia de credenciais
    ├── webhook-queue.service.ts    # Fila de webhooks
    └── idempotency.service.ts      # Controle de idempotência
```

### Funcionalidades Principais por Serviço

#### CarrierService

```typescript
// CRUD básico
async createCarrier(data: CreateCarrierInput): Promise<Carrier>
async updateCarrier(id: string, data: UpdateCarrierInput): Promise<Carrier>
async getCarrier(id: string): Promise<Carrier | null>
async listCarriers(query: ListCarriersQuery): Promise<PaginatedResult<Carrier>>
async deleteCarrier(id: string): Promise<void>

// Teste de conexão
async testConnection(carrierId: string, env: Environment): Promise<TestResult>
```

#### CarrierWebhookService

```typescript
// Recebimento e validação
async receiveWebhook(input: ProcessCarrierWebhookInput): Promise<WebhookResult>

// Validação de assinatura
async validateSignature(payload: unknown, signature: string, carrierId: string): Promise<boolean>

// Processamento
async processWebhook(webhookId: string): Promise<void>

// Reprocessamento
async retryFailedWebhooks(): Promise<number>

// Idempotência
async isProcessed(carrierId: string, externalId: string, eventType: string): Promise<boolean>
```

#### CarrierHealthService

```typescript
// Health check manual
async performHealthCheck(carrierId: string): Promise<HealthCheckResult>

// Health check automático (cron)
async performAllHealthChecks(): Promise<HealthCheckSummary>

// Métricas
async getHealthMetrics(carrierId: string, period: string): Promise<HealthMetrics>

// Status atual
async getCurrentHealth(carrierId: string): Promise<HealthStatus>
```

#### TransactionService

```typescript
// Criação de transação
async createTransaction(input: CreatePaymentTransactionInput): Promise<PaymentTransaction>

// Atualização de status
async updateTransactionStatus(id: string, status: TransactionStatus, externalData?: unknown): Promise<PaymentTransaction>

// Autorizar (2-step)
async authorizeTransaction(transactionId: string): Promise<AuthorizationResult>

// Capturar (2-step)
async captureTransaction(transactionId: string, amountCents?: number): Promise<CaptureResult>

// Cobrar (1-step)
async chargeTransaction(transactionId: string): Promise<ChargeResult>

// Cancelar
async cancelTransaction(transactionId: string): Promise<void>

// Consulta
async getTransaction(id: string): Promise<PaymentTransaction | null>
async listTransactions(query: ListTransactionsQuery): Promise<PaginatedResult<PaymentTransaction>>
```

#### RefundService

```typescript
// Criar reembolso
async createRefund(input: CreatePaymentRefundInput): Promise<PaymentRefund>

// Processar reembolso (chamada ao gateway)
async processRefund(refundId: string): Promise<RefundResult>

// Validações
async validateRefundAmount(transactionId: string, amountCents: number): Promise<ValidationResult>

// Listagem
async listRefunds(transactionId: string): Promise<PaymentRefund[]>
```

#### LedgerService

```typescript
// Criar lançamento
async createEntry(input: CreateLedgerEntryInput): Promise<LedgerEntry>

// Criar lançamentos em lote (transação)
async createEntries(entries: CreateLedgerEntryInput[]): Promise<LedgerEntry[]>

// Extrato por conta
async getAccountStatement(accountType: string, accountId: string, period: Period): Promise<AccountStatement>

// Balanço
async getAccountBalance(accountType: string, accountId: string): Promise<Balance>

// Reconciliação
async reconcileTransactions(gatewayId: string, period: Period): Promise<ReconciliationReport>
```

#### EncryptionService

```typescript
// Criptografar credencial
async encrypt(plaintext: string): Promise<string>

// Descriptografar credencial
async decrypt(ciphertext: string): Promise<string>

// Rotacionar chaves
async rotateCredential(credentialId: string): Promise<void>
```

Usa AES-256-GCM com chaves armazenadas em variáveis de ambiente.

#### WebhookQueueService

```typescript
// Adicionar à fila
async enqueue(webhook: CarrierWebhook | PaymentWebhook): Promise<void>

// Processar fila
async processQueue(): Promise<ProcessResult>

// Reprocessar falhas
async retryFailed(): Promise<number>

// Limpeza de processados
async cleanupProcessed(olderThan: Date): Promise<number>
```

---

## API Endpoints

### Admin - Transportadoras

**Base**: `/api/admin/integrations/carriers`

#### Transportadoras

```
POST   /api/admin/integrations/carriers
GET    /api/admin/integrations/carriers
GET    /api/admin/integrations/carriers/:id
PATCH  /api/admin/integrations/carriers/:id
DELETE /api/admin/integrations/carriers/:id
POST   /api/admin/integrations/carriers/:id/test-connection
```

#### Serviços

```
POST   /api/admin/integrations/carriers/:carrierId/services
GET    /api/admin/integrations/carriers/:carrierId/services
PATCH  /api/admin/integrations/carriers/:carrierId/services/:id
DELETE /api/admin/integrations/carriers/:carrierId/services/:id
```

#### Endpoints

```
POST   /api/admin/integrations/carriers/:carrierId/endpoints
GET    /api/admin/integrations/carriers/:carrierId/endpoints
PATCH  /api/admin/integrations/carriers/:carrierId/endpoints/:id
DELETE /api/admin/integrations/carriers/:carrierId/endpoints/:id
POST   /api/admin/integrations/carriers/:carrierId/endpoints/:id/test
```

#### Credenciais

```
POST   /api/admin/integrations/carriers/:carrierId/credentials
GET    /api/admin/integrations/carriers/:carrierId/credentials
PATCH  /api/admin/integrations/carriers/:carrierId/credentials/:id
DELETE /api/admin/integrations/carriers/:carrierId/credentials/:id
POST   /api/admin/integrations/carriers/:carrierId/credentials/:id/rotate
```

#### Regras Tarifárias

```
POST   /api/admin/integrations/carriers/:carrierId/pricing-rules
GET    /api/admin/integrations/carriers/:carrierId/pricing-rules
PATCH  /api/admin/integrations/carriers/:carrierId/pricing-rules/:id
DELETE /api/admin/integrations/carriers/:carrierId/pricing-rules/:id
```

#### Health & Logs

```
GET    /api/admin/integrations/carriers/:id/health
POST   /api/admin/integrations/carriers/:id/health/check
GET    /api/admin/integrations/carriers/:id/logs
GET    /api/admin/integrations/carriers/:id/webhooks
POST   /api/admin/integrations/carriers/:id/webhooks/:webhookId/retry
```

### Admin - Pagamentos

**Base**: `/api/admin/integrations/payments`

#### Gateways

```
POST   /api/admin/integrations/payments/gateways
GET    /api/admin/integrations/payments/gateways
GET    /api/admin/integrations/payments/gateways/:id
PATCH  /api/admin/integrations/payments/gateways/:id
DELETE /api/admin/integrations/payments/gateways/:id
POST   /api/admin/integrations/payments/gateways/:id/test-connection
```

#### Credenciais

```
POST   /api/admin/integrations/payments/gateways/:gatewayId/credentials
GET    /api/admin/integrations/payments/gateways/:gatewayId/credentials
PATCH  /api/admin/integrations/payments/gateways/:gatewayId/credentials/:id
DELETE /api/admin/integrations/payments/gateways/:gatewayId/credentials/:id
POST   /api/admin/integrations/payments/gateways/:gatewayId/credentials/:id/rotate
```

#### Endpoints

```
POST   /api/admin/integrations/payments/gateways/:gatewayId/endpoints
GET    /api/admin/integrations/payments/gateways/:gatewayId/endpoints
PATCH  /api/admin/integrations/payments/gateways/:gatewayId/endpoints/:id
DELETE /api/admin/integrations/payments/gateways/:gatewayId/endpoints/:id
POST   /api/admin/integrations/payments/gateways/:gatewayId/endpoints/:id/test
```

#### Transações

```
GET    /api/admin/integrations/payments/transactions
GET    /api/admin/integrations/payments/transactions/:id
POST   /api/admin/integrations/payments/transactions/:id/refund
POST   /api/admin/integrations/payments/transactions/:id/cancel
GET    /api/admin/integrations/payments/transactions/:id/refunds
GET    /api/admin/integrations/payments/transactions/:id/chargebacks
```

#### Ledger

```
GET    /api/admin/integrations/payments/ledger
GET    /api/admin/integrations/payments/ledger/accounts/:type/:id
POST   /api/admin/integrations/payments/ledger/reconcile
POST   /api/admin/integrations/payments/ledger/entries (manual adjustments)
```

#### Health & Logs

```
GET    /api/admin/integrations/payments/gateways/:id/health
POST   /api/admin/integrations/payments/gateways/:id/health/check
GET    /api/admin/integrations/payments/gateways/:id/webhooks
POST   /api/admin/integrations/payments/gateways/:id/webhooks/:webhookId/retry
```

### Public - Webhooks

Endpoints públicos para recebimento de webhooks das integrações.

```
POST   /api/webhooks/carriers/:slug          # Tracking updates
POST   /api/webhooks/payments/:slug          # Payment events
```

**Segurança**:
- Validação de assinatura
- Rate limiting
- IP whitelist (opcional)

---

## Autenticação e Segurança

### RBAC

Acesso a `/admin/integrations` restrito a:
- Permissão: `INTEGRACOES`
- Roles: `admin`, `superadmin`

```typescript
// Middleware de autorização
async function requireIntegrationsPermission(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!session.permissions.includes('INTEGRACOES') && !session.isSuperAdmin) {
    return new Response('Forbidden', { status: 403 });
  }

  return session;
}
```

### Auditoria

Todas ações sensíveis são registradas em `StaffAuditLog`:

**Ações Auditadas**:
- Visualização de credenciais (`view_credential`)
- Rotação de chaves (`rotate_credential`)
- Alteração de endpoint (`update_endpoint`)
- Teste de conexão (`test_connection`)
- Reprocessamento de webhook (`retry_webhook`)

```typescript
await auditLog.create({
  actorId: session.userId,
  action: 'view_credential',
  entity: 'CarrierCredential',
  entityId: credentialId,
  data: {
    carrierId,
    environment,
    maskedData: maskCredentials(credential),
  },
});
```

### Criptografia

**Algoritmo**: AES-256-GCM

**Campos Criptografados**:
- Todas credenciais (`apiKey`, `clientSecret`, `password`, `token`, etc)
- Tokens de acesso OAuth2
- Chaves secretas de gateways

**Implementação**:
```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Validação de Webhooks

**Carrier Webhooks**:
```typescript
function validateCarrierWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Payment Webhooks**: Similar, com variações por gateway (Stripe usa `stripe-signature` header, etc)

---

## Processamento de Webhooks

### Arquitetura

1. **Recebimento** (`POST /api/webhooks/:type/:slug`)
   - Validação de assinatura
   - Persistência imediata (status: `pending`)
   - Resposta 200 OK (fast acknowledge)

2. **Processamento Assíncrono**
   - Worker processa fila de webhooks `pending`
   - Atualiza status para `processed` ou `failed`
   - Registra erro se falhar

3. **Retentativas**
   - Webhooks `failed` são reprocessados automaticamente
   - Backoff exponencial: 1min, 2min, 4min, 8min, 16min...
   - Máximo de 5 tentativas (configurável)

4. **Idempotência**
   - Check de `(carrierId|gatewayId, externalId, eventType)` único
   - Eventos duplicados são ignorados

### Fluxo de Processamento

#### Carrier Tracking Webhook

```typescript
async function processCarrierTrackingWebhook(webhook: CarrierWebhook) {
  // 1. Extrair dados do payload
  const { trackingCode, status, location, timestamp } = parsePayload(webhook.payload);

  // 2. Buscar shipment pelo tracking code
  const shipment = await prisma.shipment.findUnique({
    where: { trackingCode },
  });

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  // 3. Atualizar status do shipment
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: { status: mapStatus(status) },
  });

  // 4. Criar evento de rastreamento
  await prisma.trackingEvent.create({
    data: {
      shipmentId: shipment.id,
      type: mapEventType(status),
      description: `Status: ${status}`,
      city: location?.city,
      uf: location?.uf,
      occurredAt: new Date(timestamp),
    },
  });

  // 5. Notificar usuário (opcional)
  await notifyUser(shipment.senderId, {
    type: 'tracking_update',
    trackingCode,
    status,
  });
}
```

#### Payment Event Webhook

```typescript
async function processPaymentEventWebhook(webhook: PaymentWebhook) {
  const { eventType, externalId, data } = parsePayload(webhook.payload);

  // Buscar transação
  const transaction = await prisma.paymentTransaction.findFirst({
    where: { externalId },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  switch (eventType) {
    case 'payment.authorized':
      await handleAuthorized(transaction, data);
      break;
    case 'payment.captured':
    case 'payment.paid':
      await handlePaid(transaction, data);
      break;
    case 'payment.refunded':
      await handleRefunded(transaction, data);
      break;
    case 'payment.chargeback':
      await handleChargeback(transaction, data);
      break;
    case 'payment.failed':
      await handleFailed(transaction, data);
      break;
  }
}

async function handlePaid(transaction: PaymentTransaction, data: unknown) {
  // 1. Atualizar status da transação
  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      feeCents: data.fee,
      netCents: transaction.amountCents - data.fee,
    },
  });

  // 2. Criar lançamentos no ledger
  await createLedgerEntries(transaction, data.fee);

  // 3. Atualizar carteira do usuário (se aplicável)
  if (transaction.userId) {
    await creditUserWallet(transaction.userId, transaction.netCents);
  }

  // 4. Notificar usuário
  await notifyUser(transaction.userId, {
    type: 'payment_confirmed',
    transactionId: transaction.id,
    amount: transaction.amountCents,
  });
}

async function createLedgerEntries(transaction: PaymentTransaction, feeCents: number) {
  const entries = [
    // Débito do cliente (receita)
    {
      type: 'CHARGE',
      amountCents: transaction.amountCents,
      accountType: 'platform',
      accountId: null,
      description: `Pagamento recebido: ${transaction.referenceId}`,
      transactionId: transaction.id,
    },
    // Taxa do gateway (despesa)
    {
      type: 'FEE',
      amountCents: -feeCents,
      accountType: 'platform',
      accountId: null,
      description: `Taxa gateway: ${transaction.referenceId}`,
      transactionId: transaction.id,
    },
  ];

  // Se for para carteira de usuário, creditar
  if (transaction.userId && transaction.metadata?.creditWallet) {
    entries.push({
      type: 'CHARGE',
      amountCents: transaction.netCents,
      accountType: 'user_wallet',
      accountId: transaction.userId,
      description: `Crédito de saldo: ${transaction.referenceId}`,
      transactionId: transaction.id,
    });
  }

  await prisma.ledgerEntry.createMany({ data: entries });
}
```

### Worker de Reprocessamento

Cron job que roda a cada minuto:

```typescript
// Arquivo: lib/integrations/workers/webhook-processor.ts

export async function processWebhookQueue() {
  const now = new Date();

  // Processar carrier webhooks pendentes ou com retry
  const carrierWebhooks = await prisma.carrierWebhook.findMany({
    where: {
      OR: [
        { status: 'pending' },
        {
          status: 'failed',
          nextRetryAt: { lte: now },
          retryCount: { lt: prisma.carrierWebhook.fields.maxRetries },
        },
      ],
    },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });

  for (const webhook of carrierWebhooks) {
    try {
      await processCarrierWebhook(webhook);

      await prisma.carrierWebhook.update({
        where: { id: webhook.id },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      });
    } catch (error) {
      const retryCount = webhook.retryCount + 1;
      const shouldRetry = retryCount < webhook.maxRetries;

      await prisma.carrierWebhook.update({
        where: { id: webhook.id },
        data: {
          status: shouldRetry ? 'failed' : 'failed',
          retryCount,
          errorMessage: error.message,
          nextRetryAt: shouldRetry ? calculateNextRetry(retryCount) : null,
        },
      });

      console.error(`[WEBHOOK_ERROR] ${webhook.id}:`, error);
    }
  }

  // Mesmo processo para payment webhooks
  // ...

  return {
    processed: carrierWebhooks.length,
  };
}
```

---

## Monitoramento de Saúde

### Health Check Service

```typescript
// lib/integrations/shared/health-check.service.ts

export async function performHealthCheck(
  type: 'carrier' | 'payment',
  integrationId: string
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Buscar integração
    const integration = await getIntegration(type, integrationId);

    // Buscar credenciais ativas
    const credential = await getActiveCredential(type, integrationId);

    // Fazer chamada de teste ao endpoint de health/ping
    const response = await makeTestRequest(integration, credential);

    const duration = Date.now() - startTime;

    // Calcular métricas das últimas 24h
    const metrics = await calculateMetrics(type, integrationId);

    // Determinar status
    const status = determineHealthStatus(response.status, metrics);

    // Registrar health check
    await recordHealthCheck(type, integrationId, {
      status,
      responseTime: duration,
      successRate: metrics.successRate,
      avgLatency: metrics.avgLatency,
    });

    return {
      status,
      responseTime: duration,
      metrics,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    await recordHealthCheck(type, integrationId, {
      status: 'DOWN',
      responseTime: duration,
      errorMessage: error.message,
    });

    return {
      status: 'DOWN',
      error: error.message,
    };
  }
}

function determineHealthStatus(
  statusCode: number,
  metrics: HealthMetrics
): HealthStatus {
  if (statusCode !== 200) return 'DOWN';
  if (metrics.successRate < 50) return 'DOWN';
  if (metrics.successRate < 90) return 'DEGRADED';
  return 'HEALTHY';
}

async function calculateMetrics(
  type: string,
  integrationId: string
): Promise<HealthMetrics> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h atrás

  const apiCalls = await prisma.carrierApiCall.findMany({
    where: {
      carrierId: integrationId,
      startedAt: { gte: since },
    },
  });

  const total = apiCalls.length;
  const successful = apiCalls.filter(call => call.success).length;
  const totalLatency = apiCalls.reduce((sum, call) => sum + (call.duration || 0), 0);

  return {
    successRate: total > 0 ? (successful / total) * 100 : 100,
    avgLatency: total > 0 ? totalLatency / total : 0,
    totalCalls: total,
  };
}
```

### Cron Job de Health Checks

```typescript
// Roda a cada 5 minutos
export async function performAllHealthChecks() {
  // Carriers ativos
  const carriers = await prisma.carrier.findMany({
    where: { status: 'ACTIVE' },
  });

  for (const carrier of carriers) {
    await performHealthCheck('carrier', carrier.id);
  }

  // Payment gateways ativos
  const gateways = await prisma.paymentGateway.findMany({
    where: { status: 'ACTIVE' },
  });

  for (const gateway of gateways) {
    await performHealthCheck('payment', gateway.id);
  }
}
```

---

## Integração com Sistema de Cotações

O sistema de cotações (`/cotacoes`) consome as integrações de transportadoras:

```typescript
// lib/quotes/service.ts (modificado)

import { callCarrierQuoteEndpoint } from '@/lib/integrations/carriers/carrier-api.service';

async function calculateShippingOptions(request: QuoteRequest): Promise<QuoteResultItem[]> {
  // Buscar transportadoras ativas
  const carriers = await prisma.carrier.findMany({
    where: {
      status: 'ACTIVE',
      environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX',
    },
    include: {
      services: { where: { isActive: true } },
      endpoints: { where: { operation: 'quote' } },
      credentials: { where: { isActive: true } },
      pricingRules: { where: { isActive: true }, orderBy: { priority: 'asc' } },
    },
  });

  const results: QuoteResultItem[] = [];

  // Para cada transportadora, chamar endpoint de cotação
  for (const carrier of carriers) {
    try {
      const quoteEndpoint = carrier.endpoints.find(e => e.operation === 'quote');
      if (!quoteEndpoint) continue;

      const credential = carrier.credentials[0];
      if (!credential) continue;

      // Chamar API da transportadora
      const response = await callCarrierQuoteEndpoint(carrier, quoteEndpoint, credential, {
        originCep: request.origem.cep,
        destCep: request.destino.cep,
        volumes: request.volumes,
      });

      // Aplicar regras tarifárias locais (markup, desconto, etc)
      const adjustedResults = applyPricingRules(
        carrier.pricingRules,
        response.services,
        request
      );

      results.push(...adjustedResults);
    } catch (error) {
      console.error(`[QUOTE_CARRIER_ERROR] ${carrier.slug}:`, error);
      // Continua com outras transportadoras mesmo se uma falhar
    }
  }

  return results.sort((a, b) => a.preco - b.preco);
}
```

---

## Checklist de Operação

### Como Testar Conexão

1. Acessar `/admin/integracoes`
2. Selecionar transportadora ou gateway
3. Ir para aba "Status & Saúde"
4. Clicar em "Testar Conexão"
5. Sistema valida credenciais e faz chamada de teste
6. Resultado exibido (sucesso/falha + latência)

### Como Rotacionar Credenciais

1. Ir para aba "Autenticação"
2. Selecionar credencial ativa
3. Clicar em "Rotacionar Chave"
4. Inserir novas credenciais no modal
5. Sistema:
   - Salva novas credenciais (encrypted)
   - Marca antigas como inativas
   - Registra auditoria
   - Testa conexão com novas credenciais
6. Rollback manual se falhar

### Como Reprocessar Eventos

1. Ir para aba "APIs & Endpoints"
2. Scroll até seção "Webhooks Recentes"
3. Filtrar por status: "failed"
4. Selecionar webhook(s)
5. Clicar em "Reprocessar"
6. Sistema reprocessa imediatamente (sem aguardar retry schedule)

### Como Adicionar Nova Transportadora

1. POST `/api/admin/integrations/carriers`
   ```json
   {
     "name": "Nova Transportadora",
     "slug": "nova-transportadora",
     "baseUrl": "https://api.nova-transportadora.com",
     "environment": "SANDBOX"
   }
   ```

2. POST `/api/admin/integrations/carriers/:id/services`
   ```json
   {
     "serviceId": "express",
     "name": "Expresso",
     "type": "express",
     "minDays": 1,
     "maxDays": 3
   }
   ```

3. POST `/api/admin/integrations/carriers/:id/endpoints`
   ```json
   {
     "operation": "quote",
     "method": "POST",
     "path": "/v1/cotacao",
     "requestMapping": { /* mapeamento campos */ },
     "responseMapping": { /* mapeamento resposta */ }
   }
   ```

4. POST `/api/admin/integrations/carriers/:id/credentials`
   ```json
   {
     "environment": "SANDBOX",
     "authType": "API_KEY",
     "apiKey": "sk_test_xxx"
   }
   ```

5. Testar conexão

6. POST `/api/admin/integrations/carriers/:id/pricing-rules`
   ```json
   {
     "name": "Regra Padrão",
     "basePriceCents": 1500,
     "pricePerKg": 200,
     "insurancePercent": 2.5
   }
   ```

7. Ativar: PATCH status para `ACTIVE`

---

## Observabilidade

### Logs Estruturados

Todos logs seguem formato JSON:

```json
{
  "timestamp": "2025-11-03T13:45:30.123Z",
  "level": "info",
  "service": "integrations",
  "module": "carrier-api",
  "carrierId": "clxxx",
  "operation": "quote",
  "duration": 245,
  "success": true,
  "correlationId": "req_abc123"
}
```

### Métricas

**Por Transportadora**:
- Taxa de sucesso (últimas 24h)
- Latência média/p95/p99
- Total de chamadas
- Erros por tipo

**Por Gateway de Pagamento**:
- Taxa de aprovação
- Taxa de recusa
- Chargebacks
- Refunds
- Volume transacionado

**Webhooks**:
- Webhooks recebidos/processados/falhados
- Tempo médio de processamento
- Fila atual

### Alertas

Condições de alerta:
- Health status = DOWN por > 5min
- Taxa de sucesso < 50% por > 15min
- Fila de webhooks > 1000
- Latência p95 > 10s

---

## Performance

### Estratégias

1. **Indexes**: Todos queries críticos têm indexes apropriados
2. **Paginação**: Máximo 100 registros por página
3. **Caching**:
   - Health status (5 minutos)
   - Carrier list (10 minutos)
   - Pricing rules (15 minutos)
4. **Connection Pooling**: Prisma com pool de 20 conexões
5. **Timeouts**: Configuráveis por integração (padrão 30s)
6. **Rate Limiting**: 100 req/min por integração externa
7. **Batch Processing**: Webhooks processados em lotes de 100

### Limpeza de Dados

Cron jobs de limpeza:
- `CarrierApiCall`: 30 dias
- `CarrierWebhook` (processed): 90 dias
- `PaymentWebhook` (processed): 90 dias
- `HealthCheck`: 7 dias

---

## LGPD/Compliance

### Dados Pessoais

Inventário de dados pessoais que podem trafegar:
- **Transportadoras**:
  - Nome do remetente/destinatário (endereços)
  - CPF/CNPJ em alguns casos
  - Telefone/email em alguns casos

- **Pagamentos**:
  - Nome do titular do cartão
  - CPF
  - Email
  - Endereço de cobrança

### Retenção

- Credenciais: Mantidas enquanto integração ativa
- Webhooks processados: 90 dias
- Logs de API: 30 dias
- Transações: Permanente (obrigação fiscal)
- Health checks: 7 dias

### Acesso

- Visualização de credenciais: Auditada
- Credenciais sempre mascaradas em listagens
- Acesso completo somente com permissão explícita

### Criptografia

- Em repouso: Credenciais criptografadas (AES-256-GCM)
- Em trânsito: HTTPS obrigatório
- Backups: Criptografados

---

## Testes

### Estrutura de Testes

```
__tests__/
├── integrations/
│   ├── carriers/
│   │   ├── carrier.service.test.ts
│   │   ├── carrier-webhook.test.ts
│   │   └── carrier-health.test.ts
│   ├── payments/
│   │   ├── gateway.service.test.ts
│   │   ├── transaction.service.test.ts
│   │   ├── refund.service.test.ts
│   │   └── payment-webhook.test.ts
│   └── shared/
│       ├── encryption.test.ts
│       └── webhook-queue.test.ts
└── api/
    ├── carriers.test.ts
    └── payments.test.ts
```

### Casos de Teste Críticos

#### Webhooks

```typescript
test('webhook idempotency', async () => {
  const payload = { /* ... */ };

  // Primeiro processamento
  await processWebhook(payload);

  // Segundo processamento (duplicado)
  await processWebhook(payload);

  // Deve ter processado apenas uma vez
  const count = await prisma.carrierWebhook.count({
    where: { externalId: payload.trackingCode },
  });
  expect(count).toBe(1);
});

test('webhook retry with backoff', async () => {
  // Mock que falha 2 vezes e sucede na 3ª
  const mockProcess = jest.fn()
    .mockRejectedValueOnce(new Error('Fail 1'))
    .mockRejectedValueOnce(new Error('Fail 2'))
    .mockResolvedValueOnce({ success: true });

  const webhook = await createWebhook({ /* ... */ });

  // Tentativa 1 - falha
  await processWebhookWithRetry(webhook.id, mockProcess);
  expect(webhook.retryCount).toBe(1);

  // Tentativa 2 - falha
  await processWebhookWithRetry(webhook.id, mockProcess);
  expect(webhook.retryCount).toBe(2);

  // Tentativa 3 - sucesso
  await processWebhookWithRetry(webhook.id, mockProcess);
  expect(webhook.status).toBe('processed');
  expect(mockProcess).toHaveBeenCalledTimes(3);
});
```

#### Transações

```typescript
test('transaction refund validation', async () => {
  const transaction = await createTransaction({ amountCents: 10000 });

  // Refund válido
  const refund1 = await createRefund({
    transactionId: transaction.id,
    amountCents: 5000,
  });
  expect(refund1).toBeDefined();

  // Refund que excede o valor - deve falhar
  await expect(createRefund({
    transactionId: transaction.id,
    amountCents: 6000, // 5000 + 6000 > 10000
  })).rejects.toThrow('Refund amount exceeds transaction amount');
});

test('ledger double-entry consistency', async () => {
  const transaction = await createTransaction({ amountCents: 10000 });

  await handleTransactionPaid(transaction.id, { feeCents: 500 });

  // Buscar lançamentos
  const entries = await prisma.ledgerEntry.findMany({
    where: { transactionId: transaction.id },
  });

  // Soma deve ser zero (double-entry)
  const sum = entries.reduce((acc, e) => acc + e.amountCents, 0);
  expect(sum).toBe(0);
});
```

#### Credenciais

```typescript
test('credential encryption/decryption', async () => {
  const plaintext = 'sk_test_secret_key_12345';

  const encrypted = await encrypt(plaintext);
  expect(encrypted).not.toBe(plaintext);
  expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

  const decrypted = await decrypt(encrypted);
  expect(decrypted).toBe(plaintext);
});

test('credential masking', () => {
  const credential = {
    apiKey: 'sk_test_1234567890abcdef',
    clientSecret: 'secret_xyz',
  };

  const masked = maskCredentials(credential);

  expect(masked.apiKey).not.toBe(credential.apiKey);
  expect(masked.apiKey).toContain('****');
  expect(masked.clientSecret).toBe('****** (hidden)');
});
```

#### Health Checks

```typescript
test('health status determination', () => {
  const metrics = { successRate: 95, avgLatency: 200 };
  expect(determineHealthStatus(200, metrics)).toBe('HEALTHY');

  metrics.successRate = 85;
  expect(determineHealthStatus(200, metrics)).toBe('DEGRADED');

  metrics.successRate = 45;
  expect(determineHealthStatus(200, metrics)).toBe('DOWN');

  expect(determineHealthStatus(500, { successRate: 95 })).toBe('DOWN');
});
```

---

## Código de Erro

### Carriers

| Código | Descrição |
|--------|-----------|
| `CARRIER_NOT_FOUND` | Transportadora não encontrada |
| `CARRIER_INACTIVE` | Transportadora inativa |
| `CREDENTIAL_MISSING` | Credencial não configurada |
| `CREDENTIAL_INVALID` | Credencial inválida ou expirada |
| `ENDPOINT_NOT_CONFIGURED` | Endpoint não configurado |
| `API_CALL_FAILED` | Falha na chamada à API externa |
| `API_TIMEOUT` | Timeout na chamada |
| `SIGNATURE_INVALID` | Assinatura de webhook inválida |
| `WEBHOOK_ALREADY_PROCESSED` | Webhook já processado |
| `PRICING_RULE_CONFLICT` | Conflito entre regras tarifárias |

### Payments

| Código | Descrição |
|--------|-----------|
| `GATEWAY_NOT_FOUND` | Gateway não encontrado |
| `GATEWAY_INACTIVE` | Gateway inativo |
| `METHOD_NOT_ENABLED` | Método de pagamento não habilitado |
| `TRANSACTION_NOT_FOUND` | Transação não encontrada |
| `INVALID_TRANSACTION_STATUS` | Status inválido para operação |
| `REFUND_AMOUNT_EXCEEDS` | Valor de reembolso excede transação |
| `CANNOT_REFUND` | Transação não pode ser reembolsada |
| `CANNOT_CANCEL` | Transação não pode ser cancelada |
| `DUPLICATE_REFERENCE` | Reference ID duplicado |
| `PAYMENT_DECLINED` | Pagamento recusado pelo gateway |

---

## Conclusão

Este documento descreve a arquitetura completa do sistema de integrações do Envio Legal, cobrindo:

✅ Modelo de dados completo (18 entidades principais)
✅ Validação e schemas Zod
✅ Arquitetura de serviços
✅ API endpoints (50+ rotas)
✅ Processamento de webhooks com fila e retry
✅ Sistema de health checks
✅ Criptografia e segurança
✅ Integração com cotações e pagamentos
✅ Auditoria e RBAC
✅ Observabilidade (logs, métricas, alertas)
✅ Performance e otimizações
✅ Compliance LGPD
✅ Testes e validações

**Status**: Sistema pronto para implementação linha por linha seguindo esta especificação.
