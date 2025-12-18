# Integração Mercado Pago - Documentação

## Visão Geral

Esta documentação descreve a integração completa do Envio Legal com o Mercado Pago como gateway de pagamento.

A integração utiliza:
- **Checkout API** do Mercado Pago para criação de pagamentos
- **Webhooks** para notificações assíncronas de mudanças de status
- **SDK Node.js oficial** para comunicação com a API
- **HMAC-SHA256** para validação de autenticidade dos webhooks

## Arquitetura

```
┌─────────────────┐
│   Frontend      │
│  (Payment Brick)│
└────────┬────────┘
         │ POST /api/payments/mercadopago/create
         ▼
┌─────────────────────────────────────────┐
│  Backend (Next.js API Routes)           │
│                                          │
│  ┌────────────────────────────────┐    │
│  │ /lib/mercadopago/              │    │
│  │  - config.ts    (configuração) │    │
│  │  - client.ts    (SDK MP)       │    │
│  │  - payments.ts  (lógica)       │    │
│  │  - webhooks.ts  (validação)    │    │
│  └────────────────────────────────┘    │
│                                          │
│  ┌────────────────────────────────┐    │
│  │ Prisma ORM                      │    │
│  │  - PaymentGateway              │    │
│  │  - PaymentCredential           │    │
│  │  - PaymentTransaction          │    │
│  │  - PaymentWebhook              │    │
│  │  - Wallet / WalletTransaction  │    │
│  └────────────────────────────────┘    │
└──────────┬──────────────▲───────────────┘
           │              │
           │              │ POST /api/webhooks/mercadopago
           ▼              │
┌──────────────────────────────────┐
│   Mercado Pago API               │
│   - POST /v1/payments            │
│   - GET /v1/payments/:id         │
│   - Webhooks                     │
└──────────────────────────────────┘
```

## Estrutura de Arquivos

### Serviços (`/lib/mercadopago/`)

- **`types.ts`** - Tipos TypeScript (CreatePaymentInput, MercadoPagoPaymentResponse, etc)
- **`config.ts`** - Busca configuração do banco com fallback para env vars
- **`client.ts`** - Cliente MP com SDK oficial (createPayment, getPaymentById, etc)
- **`payments.ts`** - Lógica de negócio (criar transação + aplicar efeitos de domínio)
- **`webhooks.ts`** - Validação de assinatura + processamento de notificações
- **`index.ts`** - Exportações centralizadas

### Rotas de API (`/app/api/`)

#### Admin (Configuração)
- **`/api/admin/integrations/mercadopago` (GET/POST)** - Gerenciar credenciais
- **`/api/admin/integrations/mercadopago/test-webhook` (POST)** - Testar webhook

#### Pagamentos (Frontend)
- **`/api/payments/mercadopago/create` (POST)** - Criar pagamento

#### Webhooks (Mercado Pago)
- **`/api/webhooks/mercadopago` (POST)** - Receber notificações

## Fluxos de Uso

### 1. Fluxo de Recarga de Carteira (Wallet Topup)

```
1. Usuário abre modal "Adicionar Saldo"
   ↓
2. Frontend renderiza Payment Brick do MP
   ↓
3. Usuário preenche dados do pagamento
   ↓
4. Frontend chama POST /api/payments/mercadopago/create
   {
     transactionAmount: 100.00,
     token: "card_token_xyz",
     paymentMethodId: "visa",
     metadata: { type: "wallet_topup" }
   }
   ↓
5. Backend:
   - Cria PaymentTransaction com status PENDING
   - Chama Mercado Pago API
   - Atualiza PaymentTransaction com externalId e novo status
   - Se status = PAID, credita carteira imediatamente
   ↓
6. Frontend exibe resultado (approved/pending/rejected)
   ↓
7. [Assíncrono] Mercado Pago envia webhook
   ↓
8. Backend (webhook):
   - Valida assinatura HMAC-SHA256
   - Busca pagamento no MP (GET /v1/payments/:id)
   - Atualiza PaymentTransaction
   - Se mudou para PAID, credita carteira (idempotente)
```

### 2. Fluxo de Pagamento de Checkout (Envios)

```
1. Usuário finaliza checkout de envios
   ↓
2. Frontend chama POST /api/payments/mercadopago/create
   {
     transactionAmount: 250.00,
     paymentMethodId: "pix",
     metadata: { type: "checkout_payment", shipmentId: "ship_123" }
   }
   ↓
3. Backend:
   - Cria PaymentTransaction
   - Chama MP para gerar PIX (retorna QR Code)
   - Retorna QR Code para o frontend
   ↓
4. Frontend exibe QR Code do PIX
   ↓
5. Usuário paga via app do banco
   ↓
6. Mercado Pago detecta pagamento e envia webhook
   ↓
7. Backend (webhook):
   - Atualiza PaymentTransaction para PAID
   - Marca envio como pago (lógica em applyCheckoutPayment)
   - Dispara processos de logística
```

## Configuração

### 1. Variáveis de Ambiente (Opcional - Fallback)

```env
# Mercado Pago
NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MP_ACCESS_TOKEN=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MP_WEBHOOK_SECRET=your_webhook_secret_from_mp_dashboard
MP_SANDBOX_MODE=true

# Encryption (obrigatório)
ENCRYPTION_KEY=<64 caracteres hexadecimais>
```

### 2. Configuração via Admin (Recomendado)

1. Acessar `/admin/integracoes`
2. Aba "Gate de Pagamento"
3. Preencher:
   - **Public Key** (usado no frontend)
   - **Access Token** (usado no backend - será criptografado)
   - **Webhook Secret** (opcional - para validar webhooks)
   - **Webhook URL** (ex: `https://seudominio.com/api/webhooks/mercadopago`)
   - **Sandbox Mode** (true/false)
4. Clicar em "Salvar"
5. Testar webhook com botão "Testar Webhook"

### 3. Configurar Webhook no Mercado Pago

1. Acessar [Mercado Pago Dashboard](https://www.mercadopago.com.br/developers/panel)
2. Ir em "Suas Integrações"
3. Selecionar sua aplicação
4. Ir em "Webhooks"
5. Adicionar URL: `https://seudominio.com/api/webhooks/mercadopago`
6. Selecionar eventos: `payment` (mínimo)
7. Copiar o "Secret" e colar na tela de admin

## Segurança

### 1. Criptografia de Credenciais

- **Access Token** e **Webhook Secret** são criptografados com AES-256-GCM antes de salvar no banco
- Algoritmo: `aes-256-gcm`
- Chave: `ENCRYPTION_KEY` (variável de ambiente)
- Formato: `iv:authTag:ciphertext`

```typescript
// Ao salvar
const encrypted = encrypt(accessToken);
await prisma.paymentCredential.create({ accessToken: encrypted });

// Ao usar
const decrypted = decrypt(credential.accessToken);
```

### 2. Validação de Webhooks (HMAC-SHA256)

O Mercado Pago envia um header `x-signature` com formato:
```
ts=1704908010,v1=618c85...e839
```

Validação:
```typescript
// Construir manifest
const manifest = `id:${data.id};request-id:${xRequestId};ts:${ts};`;

// Calcular HMAC
const hmac = crypto.createHmac('sha256', webhookSecret);
hmac.update(manifest);
const calculatedSignature = hmac.digest('hex');

// Comparar
if (calculatedSignature === v1) {
  // Válido
}
```

### 3. Nunca Expor Access Token

- **Public Key** pode ir para o frontend
- **Access Token** NUNCA deve ser exposto:
  - Não retornar em APIs (mascarar com `***xxxx`)
  - Não logar em console
  - Não incluir em payloads JSON

## Idempotência

### Criação de Pagamentos

Usar `referenceId` único gerado com `nanoid(16)`:

```typescript
const referenceId = `mp_${nanoid(16)}`;
```

### Webhooks

O campo `referenceId` da `PaymentTransaction` é único (Prisma constraint).

Ao processar webhook:
1. Buscar transaction por `externalId` (ID do MP)
2. Se não existir, criar nova
3. Se existir e status não mudou, não aplicar efeitos novamente
4. Se mudou para `PAID`, aplicar efeitos (crédito de carteira)

Isso garante que mesmo com múltiplos webhooks, o saldo é creditado apenas uma vez.

## Testes

### 1. Testar Webhook (Via Admin)

```bash
curl -X POST https://seudominio.com/api/admin/integrations/mercadopago/test-webhook \
  -H "Cookie: admin_auth=<seu_token>"
```

Isso dispara um payload de teste para o próprio webhook.

### 2. Testar Criação de Pagamento

```bash
curl -X POST https://seudominio.com/api/payments/mercadopago/create \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=<seu_token>" \
  -d '{
    "transactionAmount": 100.00,
    "paymentMethodId": "pix",
    "payer": {
      "email": "teste@example.com"
    },
    "metadata": {
      "type": "wallet_topup"
    }
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "transaction": {
    "id": "cuid_xxx",
    "referenceId": "mp_abc123",
    "status": "PENDING"
  },
  "payment": {
    "id": 999999999,
    "status": "pending",
    "pixQrCode": "00020126..."
  }
}
```

### 3. Testar Webhook Localmente (ngrok/Cloudflare Tunnel)

Em desenvolvimento, usar túnel para expor localhost:

```bash
# ngrok
ngrok http 3000

# Ou Cloudflare Tunnel
cloudflared tunnel --url localhost:3000
```

Configurar URL do túnel no Mercado Pago Dashboard:
```
https://xxx.ngrok-free.app/api/webhooks/mercadopago
```

## Monitoramento

### Logs

Todos os serviços logam com prefixo identificador:

```typescript
console.log('[MERCADO_PAGO_CONFIG] ...');
console.log('[MERCADO_PAGO] ...');
console.log('[WEBHOOK_MERCADOPAGO] ...');
```

### Tabelas de Auditoria

- **`PaymentTransaction`** - Histórico de todas as transações
- **`PaymentWebhook`** - Histórico de todos os webhooks recebidos
- **`WalletTransaction`** - Histórico de movimentações na carteira

### Health Check

```bash
curl https://seudominio.com/api/webhooks/mercadopago
```

Resposta:
```json
{
  "service": "Mercado Pago Webhook",
  "status": "online",
  "timestamp": "2025-11-21T..."
}
```

## Tratamento de Erros

### Erros de Pagamento

Se o Mercado Pago rejeitar:
```json
{
  "success": false,
  "message": "Erro ao criar pagamento: Cartão inválido"
}
```

Status HTTP: 500

### Erros de Webhook

- **400** - Webhook ignorado (ex: tipo de evento não suportado)
- **500** - Erro temporário (MP vai tentar reenviar)

### Retry de Webhooks

Webhooks falhados são automaticamente retentados com **exponential backoff**:

```typescript
// próxima tentativa em
const minutes = Math.pow(2, retryCount); // 2, 4, 8, 16, 32 min
```

Máximo de 5 tentativas por webhook.

## Limites e Quotas

- **Timeout de API**: 30 segundos (configurável)
- **Max Retries de Webhook**: 5 (configurável)
- **Cache de Config**: 5 minutos

## Perguntas Frequentes

### Como testar em Sandbox?

1. Usar credenciais de teste do MP (começam com `TEST-`)
2. Marcar "Sandbox Mode" como `true` na tela de admin
3. Usar [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/testing)

### Como migrar para produção?

1. Gerar credenciais de produção no MP Dashboard
2. Atualizar configuração via admin
3. Desmarcar "Sandbox Mode"
4. Atualizar URL do webhook no MP Dashboard (produção)

### O que acontece se o webhook falhar?

1. Webhook é registrado com status `FAILED`
2. Sistema tenta reenviar automaticamente (max 5x)
3. Se todas as tentativas falharem, verificar logs e reprocessar manualmente

### Como reprocessar um webhook manualmente?

```typescript
// Via script ou console admin
import { retryFailedWebhooks } from '@/lib/mercadopago';
await retryFailedWebhooks();
```

### Como adicionar suporte a outros métodos de pagamento?

Editar enum `PaymentMethod` no `schema.prisma` e adicionar mapeamento em `MP_METHOD_MAP`.

## Referências

- [Mercado Pago Checkout API](https://www.mercadopago.com.ar/developers/en/docs/checkout-api/overview)
- [Mercado Pago Webhooks](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks)
- [Mercado Pago SDK Node.js](https://github.com/mercadopago/sdk-nodejs)
- [Mercado Pago Cartões de Teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/testing)

## Suporte

Em caso de problemas, verificar:
1. Logs do backend (`console.log`)
2. Tabela `PaymentWebhook` (webhooks recebidos)
3. Tabela `PaymentTransaction` (status das transações)
4. Painel do Mercado Pago (transações e webhooks enviados)
