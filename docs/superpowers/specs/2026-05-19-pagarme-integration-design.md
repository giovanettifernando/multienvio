# Design: Migração MercadoPago → Pagar.me

**Data:** 2026-05-19  
**Status:** Completo — pronto para plano de implementação

---

## 1. Objetivo

Substituir 100% da integração MercadoPago pelo Pagar.me em todos os fluxos de pagamento da plataforma. Nenhum fluxo existente deve ser removido — tudo que o MP faz hoje deve ter equivalente no Pagar.me.

---

## 2. Decisões Tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Modelo de checkout | **Transparent (in-page)** | Mantém UX atual sem redirect |
| Cartões salvos | **Mantém** | Experiência do usuário |
| SDK frontend | **Tokenizecard.js** ou direct token API | React/Next.js — sem form HTML tradicional |
| API backend | **Orders API** (`POST /orders`) | Suporta card_token, card_id e PIX |

---

## 3. Fluxos a Migrar

| Fluxo | Arquivo principal | Métodos usados |
|---|---|---|
| Topup de carteira | `modules/wallet/...` | Cartão, PIX |
| Checkout do carrinho | `app/api/cart/checkout-paid/route.ts` | Cartão, PIX, Wallet |
| Pagamento do destinatário | `app/(public)/pagar/[token]/` | Cartão, PIX |
| Cartões salvos (vault) | `platform/integrations/mercadopago/cards.ts` | Customer + Card API |
| Webhooks | `app/api/webhooks/mercadopago/route.ts` | Eventos de pagamento |
| PIX monitor (cron) | `workers/payment/pix-monitor.worker.ts` | Polling → webhook |
| Estorno | `app/api/payments/[id]/refund/route.ts` | Refund API |

---

## 4. API Pagar.me — O que já sabemos

### Autenticação
```
Authorization: Basic base64("sk_SUACHAVE:")
User-Agent: pagarme-skill-generated/1.0
```

### Ambientes
| Ambiente | Base URL |
|---|---|
| Teste | `https://sdx-api.pagar.me/core/v5` |
| Produção | `https://api.pagar.me/core/v5` |

### Variáveis de ambiente necessárias
- `PAGARME_SECRET_KEY` — sk_test_... ou sk_live_...
- `PAGARME_BASE_URL` — URL do ambiente
- `PAGARME_PUBLIC_KEY` — chave pública para Tokenizecard.js

### Tokenização (frontend)
- Script: `https://checkout.pagar.me/v1/tokenizecard.js`
- Atributo: `data-pagarmecheckout-app-id="{public_key}"`
- Retorna: `token_XXXXXXXXXXXXXXXX` (expira em 60s, uso único)
- Alternativa: chamada direta à API de tokens (ideal para React)

### Criar Pedido — `POST /orders`

**Cartão novo (card_token):**
```json
{
  "items": [{ "amount": 10000, "description": "Recarga", "quantity": 1, "code": "ref" }],
  "customer_id": "cus_XXXXXXXXXXXXXXXX",
  "payments": [{
    "payment_method": "credit_card",
    "credit_card": {
      "installments": 1,
      "statement_descriptor": "ENVIO LEGAL",
      "card_token": "token_XXXXXXXXXXXXXXXX"
    }
  }],
  "metadata": { "type": "wallet_topup", "userId": "..." }
}
```

**Cartão salvo (card_id):**
```json
{
  "payments": [{
    "payment_method": "credit_card",
    "credit_card": {
      "installments": 1,
      "card_id": "card_XXXXXXXXXXXXXXXX"
    }
  }]
}
```

**PIX:**
```json
{
  "payment_method": "pix",
  "pix": {
    "expires_in": 1800
  }
}
```
Resposta: `charges[0].last_transaction.qr_code` (string copia-cola) e `qr_code_url` (PNG)  
Status da transaction: `waiting_payment` → PENDING, `paid` → PAID, `refunded` → REFUNDED

⚠️ **Customer obrigatório com PIX**: `name`, `email`, `document`, `phones`

### IDs e formatos
- Pedido: `or_XXXXXXXXXXXXXXXX`
- Cobrança: `ch_XXXXXXXXXXXXXXXX`
- Cliente: `cus_XXXXXXXXXXXXXXXX`
- Cartão: `card_XXXXXXXXXXXXXXXX`
- Token: `token_XXXXXXXXXXXXXXXX`

### Clientes
- Criar/upsert: `POST /customers` — **email é único**: se já existe, ATUALIZA o cadastro (não duplica)
- Obter por ID: `GET /customers/{customer_id}`
- Buscar por email: `GET /customers?email=...` (para verificar se já existe)
- Editar: `PUT /customers/{customer_id}` — ⚠️ é PUT completo, campos omitidos viram null

**Estratégia de get-or-create**: guardar `pagarmeCustomerId` no model User do banco. Na primeira compra, criar cliente via `POST /customers` e salvar o ID retornado. Nas seguintes, usar o ID salvo diretamente.

Campos mínimos para criar: `name`, `email`  
Campos extras para PIX: também `document`, `phones`

### Cartões (vault)

**Salvar cartão:** `POST /customers/{customer_id}/cards`
```json
{ "token": "token_XXXXXXXXXXXXXXXX" }
```
Resposta: `id` (`card_XXXXXXXXXXXXXXXX`), `first_six_digits`, `last_four_digits`, `brand`, `holder_name`, `exp_month`, `exp_year`, `status: "active"`  
⚠️ Idempotente: se o mesmo cartão já existe no cliente, retorna o mesmo `card_id`.

**Listar cartões:** `GET /customers/{customer_id}/cards`  
Resposta: `{ "data": [...], "paging": { "total": N } }`

**Obter cartão:** `GET /customers/{customer_id}/cards/{card_id}`

**Excluir cartão:** `DELETE /customers/{customer_id}/cards/{card_id}`  
Resposta: objeto do cartão com `status: "deleted"` e `deleted_at`.

**Fluxo "pagar e salvar":** Token é single-use (60s). Estratégia: se usuário quer salvar, backend executa `POST /customers/{id}/cards` com o token primeiro → obtém `card_id` → cria pedido com `card_id`. Para pagamento único (sem salvar), usa `card_token` diretamente no pedido.

**Status possíveis:** `active`, `deleted`, `expired`

### Cancelamento / Estorno

`DELETE /charges/{charge_id}`

**Estorno total (sem body):** cancela o valor integral.  
**Estorno parcial:** `{ "amount": N }` onde N é o valor em centavos a estornar.

Resposta (cartão de crédito):
```json
{
  "id": "ch_...",
  "status": "canceled",
  "canceled_amount": 1490,
  "last_transaction": {
    "status": "refunded",
    "operation_type": "cancel"
  }
}
```

⚠️ Não usamos boleto — a seção de boleto da doc não é relevante para este projeto.

### Webhooks

**Payload recebido:**
```json
{
  "id": "hook_XXXXXXXXXXXXXXXX",
  "account": { "id": "acc_...", "name": "Loja" },
  "type": "order.paid",
  "created_at": "2022-06-29T20:23:47",
  "data": { /* objeto completo do order/charge */ }
}
```

**Eventos relevantes:**
| Evento | Ação |
|---|---|
| `order.paid` | Marcar pedido como pago, aplicar efeitos |
| `order.payment_failed` | Notificar falha |
| `charge.paid` | Cobrança paga (alternativa ao order.paid) |
| `charge.refunded` | Processar estorno |
| `charge.chargedback` | Chargeback |
| `charge.pending` | PIX aguardando pagamento |

**Validação de assinatura:** A documentação do Pagar.me v5 **não descreve HMAC** para webhooks (diferente do MercadoPago). Estratégia de segurança: ao receber um webhook, verificar o evento fazendo `GET /orders/{order_id}` ou `GET /charges/{charge_id}` para confirmar que o estado é real antes de aplicar efeitos.

### Dados de teste
| Cartão | Resultado |
|---|---|
| `4000000000000010` | Aprovado |
| `4000000000000028` | Recusado |

---

## 5. Informações Ainda Pendentes

- [x] **PIX**: `pix.expires_in` (segundos), resposta em `charges[0].last_transaction.qr_code` e `qr_code_url`
- [x] **Webhook**: sem HMAC — verificação via lookup na API do Pagar.me
- [x] **Clientes**: `POST /customers` — campos mínimos `name`+`email`; PIX também requer `document`+`phones`
- [x] **Cartões**: `POST /customers/{id}/cards` com `{ "token": "..." }` — idempotente por número de cartão
- [x] **Deletar cartão**: `DELETE /customers/{id}/cards/{card_id}` — retorna cartão com `status: "deleted"`
- [x] **Estorno**: `DELETE /charges/{charge_id}` — body opcional `{ "amount": N }` para parcial

---

## 6. Arquitetura da Implementação

### Arquivos a criar (novo módulo)
```
platform/integrations/pagarme/
  config.ts          — busca credenciais do DB, valida, expõe getConfig()
  client.ts          — funções HTTP base (auth, error handling)
  orders.ts          — createOrder(), mapOrderStatus()
  cards.ts           — createCard(), listCards(), deleteCard()
  customers.ts       — getOrCreateCustomer()
  webhooks.ts        — validateSignature(), processWebhook()
  pix-monitor.ts     — monitorPendingPix() (fallback caso webhook falhe; avaliar se remover após estabilizar)
  types.ts           — interfaces PagarmeOrder, PagarmeCharge, etc.
  index.ts           — re-exports
```

### Arquivos a modificar (substituição direta)
```
platform/integrations/payments/payment-gateway.service.ts
  → trocar slug 'mercadopago' por 'pagarme'

app/api/payments/mercadopago/create/route.ts
  → mover para app/api/payments/pagarme/create/route.ts

app/api/webhooks/mercadopago/route.ts
  → mover para app/api/webhooks/pagarme/route.ts

app/api/admin/integrations/mercadopago/route.ts
  → mover para app/api/admin/integrations/pagarme/route.ts

modules/payments/ui/components/MercadoPagoSecurity.tsx
  → remover ou adaptar para Tokenizecard.js

modules/payments/ui/components/CheckoutCartModal.tsx
modules/payments/ui/components/PaidCheckoutModal.tsx
modules/payments/ui/components/PixPaymentView.tsx
modules/payments/ui/components/RecipientPaymentModal.tsx
modules/wallet/ui/components/CardPaymentForm.tsx
modules/wallet/ui/components/SavedCardPaymentForm.tsx
  → substituir chamadas MP por Pagar.me

workers/payment/pix-monitor.worker.ts
  → adaptar para Pagar.me (ou remover se webhooks cobrirem)

workers/webhook/mercadopago.worker.ts
  → mover para workers/webhook/pagarme.worker.ts

next.config.ts
  → atualizar domínios permitidos (remover mp, adicionar pagar.me)

prisma/schema.prisma
  → enum PaymentMethod: trocar MERCADO_PAGO por PAGARME
  → PaymentGateway: slug 'mercadopago' → 'pagarme'
```

### Arquivos a deletar (após migração completa)
```
platform/integrations/mercadopago/ (todo o diretório)
scripts/check-mp-credentials.ts
scripts/update-mp-environment.ts
scripts/test-mp-api-direct.ts
(demais scripts/obsolete já obsoletos)
```

---

## 7. Checklist de Implementação

### Fase 1 — Backend: módulo Pagar.me
- [ ] `config.ts` — credenciais + cache
- [ ] `client.ts` — HTTP base com Basic Auth
- [ ] `orders.ts` — criar pedido (cartão + PIX)
- [ ] `customers.ts` — get or create customer
- [ ] `cards.ts` — vault de cartões
- [ ] `webhooks.ts` — validar assinatura + processar eventos
- [ ] `types.ts` — tipagem completa
- [ ] `index.ts` — exports

### Fase 2 — Rotas de API
- [ ] `POST /api/payments/pagarme/create` — criar pedido
- [ ] `GET /api/payments/pagarme/public-key` — chave pública para frontend
- [ ] `POST /api/webhooks/pagarme` — receber notificações
- [ ] `POST /api/payments/[id]/refund` — estorno (adaptar)
- [ ] `GET /api/account/cards` — listar cartões salvos
- [ ] `POST /api/account/cards` — salvar cartão
- [ ] `DELETE /api/account/cards/[id]` — remover cartão

### Fase 3 — Frontend
- [ ] Integrar Tokenizecard.js (ou direct token API) substituindo MercadoPago.js
- [ ] Atualizar `CardPaymentForm.tsx`
- [ ] Atualizar `SavedCardPaymentForm.tsx`
- [ ] Atualizar `PixPaymentView.tsx` (novo QR code response)
- [ ] Atualizar `RecipientPaymentModal.tsx`
- [ ] Remover `MercadoPagoSecurity.tsx`

### Fase 4 — Banco de dados
- [ ] Migration: campo `pagarmeCustomerId String?` no model `User`
- [ ] Migration: PaymentMethod enum — adicionar `PAGARME` (manter `MERCADO_PAGO` para histórico)
- [ ] Migration: PaymentGateway slug + config structure para Pagar.me
- [ ] Decisão: **não** migrar PaymentTransactions históricas — registros MP ficam como estão

### Fase 5 — Workers e Admin
- [ ] Adaptar `pix-monitor.worker.ts` para Pagar.me
- [ ] Adaptar `mercadopago.worker.ts` → `pagarme.worker.ts`
- [ ] Painel admin `/admin/pagarme` (config + testes)

### Fase 6 — Limpeza
- [ ] Remover `platform/integrations/mercadopago/`
- [ ] Remover scripts obsoletos
- [ ] Atualizar `next.config.ts`
- [ ] Remover dependência npm `mercadopago`

---

## 8. Considerações Importantes

- **Histórico de pagamentos**: PaymentTransactions antigas com `externalId` do MP devem ser preservadas. Não migrar dados históricos — apenas novos pagamentos usam Pagar.me.
- **Cartões salvos existentes**: Os `card_id` do MP são inválidos no Pagar.me. Ao migrar, os usuários precisarão recadastrar seus cartões. Estratégia: na primeira tentativa de uso, mostrar mensagem solicitando recadastro.
- **PIX pendentes na migração**: Qualquer PIX em status PENDING no momento do deploy precisa ser resolvido (aprovar manualmente ou cancelar) antes de desligar o MP.
- **Webhook URL**: Nova URL `/api/webhooks/pagarme` precisa ser configurada no dashboard Pagar.me antes de ir para produção.
