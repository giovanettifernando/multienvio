# Remoção de Mocks de Pagamento

**Data:** 2024-11-22
**Objetivo:** Remover completamente fluxos MOCK de pagamento e garantir que toda a aplicação use exclusivamente o gateway Mercado Pago

---

## 📋 Resumo Executivo

Foram removidos **todos os fluxos mock de pagamento** da aplicação, garantindo que:

1. ✅ **Todo pagamento real** passa exclusivamente pelo gateway Mercado Pago
2. ✅ **Saldo e extrato** são gerenciados exclusivamente pela plataforma (Wallet/WalletTransaction)
3. ✅ **Sem simulações** no código de produção (apenas em testes, se necessário)

---

## 🗑️ Arquivos Removidos

### Rotas de API (Backend)

1. **`/app/api/wallet/topups/pix/route.ts`**
   - ❌ Criava topup PIX mock com QR code falso
   - ✅ **Substituído por:** `/api/payments/mercadopago/create` (gateway real)

2. **`/app/api/wallet/topups/confirm/route.ts`**
   - ❌ Simulava webhook de confirmação de pagamento
   - ✅ **Substituído por:** Webhook real do Mercado Pago (`/api/webhooks/mercadopago`)

3. **`/app/api/payments/topups/card/route.ts`**
   - ❌ Simulava pagamento com cartão, aprovação instantânea
   - ✅ **Substituído por:** Integração futura com Payment Brick do Mercado Pago

4. **`/app/api/payments/topups/pix/route.ts`**
   - ❌ Já estava desativado (410 Gone)
   - ✅ Removido completamente

5. **`/app/api/envios/finalizar/route.ts`**
   - ❌ Simulava checkout pago com base em input do cliente
   - ✅ **Substituído por:** Fluxo real de checkout (débito de carteira ou gateway)

6. **`/app/api/payments/cart/checkout/route.ts`**
   - ❌ Retornava apenas `{ok: true}` sem lógica real
   - ✅ Removido (checkout deve usar carteira ou gateway)

### Componentes (Frontend)

1. **`/components/wallet/PixQRCode.tsx`**
   - ❌ Exibia QR Code mock com botão "Já paguei" (simulava confirmação)
   - ✅ **Funcionalidade integrada** em `AddFundsModal.tsx` com QR Code real do MP

### Funções de Serviço

**Arquivo:** `lib/wallet/wallet.service.ts`

1. **`CreateTopupResult` interface** (linhas 30-36)
   - ❌ Tipo usado apenas por funções mock
   - ✅ Removido

2. **`createTopupPending()` função** (linhas 128-185)
   - ❌ Criava topup pendente sem integração com gateway
   - ❌ Gerava QR Code mock
   - ✅ Removido (topup pendente agora criado pelo módulo Mercado Pago)

3. **`confirmTransaction()` função** (linhas 191-226)
   - ❌ Simulava webhook de confirmação
   - ❌ Movia saldo de pendente para disponível manualmente
   - ✅ Removido (confirmação vem do webhook real do Mercado Pago)

4. **`generateMockQRCode()` função** (linhas 343-347)
   - ❌ Gerava QR Code falso em base64
   - ✅ Removido (QR Code vem do Mercado Pago)

---

## ✏️ Arquivos Refatorados

### 1. `components/wallet/AddFundsModal.tsx`

**Antes:**
- Chamava `/api/wallet/topups/pix` (mock)
- Chamava `/api/payments/topups/card` (mock)
- Exibia QR Code fake
- Botão "Já paguei" para simular confirmação

**Depois:**
- ✅ Chama `/api/payments/mercadopago/create` (gateway real)
- ✅ Exibe QR Code **real** do Mercado Pago (base64)
- ✅ Exibe código PIX Copia e Cola
- ✅ **Remove** botão "Já paguei" (webhook confirma automaticamente)
- ✅ Cartão de crédito desabilitado (TODO para Payment Brick)
- ✅ Mensagens claras: "Pagamentos via Mercado Pago"

**Principais mudanças:**

```typescript
// ❌ ANTES:
const response = await fetch("/api/wallet/topups/pix", { ... });

// ✅ DEPOIS:
const response = await fetch("/api/payments/mercadopago/create", {
  method: "POST",
  body: JSON.stringify({
    transactionAmount: amount,
    paymentMethodId: 'pix',
    payer: { email },
    metadata: { type: 'wallet_topup' },
  }),
});
```

```tsx
{/* ✅ QR Code REAL do Mercado Pago */}
{pixData.payment.pixQrCodeBase64 && (
  <img
    src={`data:image/png;base64,${pixData.payment.pixQrCodeBase64}`}
    alt="QR Code PIX"
  />
)}

{/* ✅ PIX Copia e Cola */}
<Alert message="PIX Copia e Cola" description={pixData.payment.pixQrCode} />
```

**Mensagens atualizadas:**
- "Aprovação automática após pagamento" (ao invés de "simulado")
- "O saldo será creditado automaticamente após a confirmação do pagamento pelo Mercado Pago"
- "Pagamentos via Mercado Pago" (destaque de segurança)

---

## 🔄 Fluxo Completo (Antes vs Depois)

### ❌ Fluxo ANTES (Mock)

```
1. Usuário clica "Adicionar saldo"
2. Frontend chama /api/wallet/topups/pix (mock)
3. Backend:
   - Cria WalletTransaction PENDING
   - Gera QR Code FALSO (generateMockQRCode)
   - Incrementa Wallet.pendingCents
4. Frontend exibe QR Code fake + botão "Já paguei"
5. Usuário clica "Já paguei"
6. Frontend chama /api/wallet/topups/confirm (mock de webhook)
7. Backend:
   - Atualiza WalletTransaction para CONFIRMED
   - Move saldo: pendingCents → availableCents
8. Saldo creditado (SEM PAGAMENTO REAL!)
```

### ✅ Fluxo DEPOIS (Real)

```
1. Usuário clica "Adicionar saldo"
2. Frontend chama /api/payments/mercadopago/create
3. Backend (lib/mercadopago/payments.ts):
   - Cria PaymentTransaction (status: PENDING)
   - Chama SDK do Mercado Pago
   - Recebe QR Code REAL
   - Atualiza PaymentTransaction com dados do MP
4. Frontend exibe:
   - QR Code REAL (base64 do Mercado Pago)
   - Código PIX Copia e Cola
   - Mensagem: "Aguardando pagamento"
5. Usuário paga via PIX no app do banco
6. Mercado Pago envia webhook → /api/webhooks/mercadopago
7. Backend (lib/mercadopago/payments.ts):
   - Atualiza PaymentTransaction (status: PAID)
   - Chama walletService.creditFromGatewayTopup()
8. Wallet Service (lib/wallet/wallet.service.ts):
   - Verifica idempotência
   - Cria WalletTransaction (CONFIRMED)
   - Atualiza Wallet.availableCents
9. Saldo creditado (PAGAMENTO REAL CONFIRMADO!)
```

---

## 🔐 Segurança e Validação

### Antes (Mocks)
- ⚠️ Cliente podia "confirmar" pagamento sem pagar
- ⚠️ Saldo creditado sem validação externa
- ⚠️ QR Code não funcionava (apenas visual)
- ⚠️ Risco de fraude

### Depois (Gateway Real)
- ✅ **Apenas o Mercado Pago** pode confirmar pagamentos (via webhook)
- ✅ **Idempotência** garante que mesmo pagamento não credita 2x
- ✅ **Atomicidade** via Prisma.$transaction (ou tudo acontece, ou nada)
- ✅ **QR Code real** que funciona em qualquer app bancário
- ✅ **Rastreabilidade** completa (PaymentTransaction → WalletTransaction)

---

## 📊 Estatísticas da Refatoração

### Código Removido
- **6 rotas de API** mock removidas
- **1 componente** React removido
- **4 funções** de serviço removidas
- **1 interface** TypeScript removida
- **~350 linhas** de código mock eliminadas

### Código Adicionado/Refatorado
- **1 componente** refatorado (`AddFundsModal.tsx`)
- **Integração real** com Mercado Pago via `/api/payments/mercadopago/create`
- **QR Code real** exibido no frontend
- **~200 linhas** de código de integração real

### Rotas que Permanecem (Corretas)
- ✅ `/api/payments/mercadopago/create` - Gateway real
- ✅ `/api/webhooks/mercadopago` - Webhook real
- ✅ `/api/wallet` - Consulta saldo (usa WalletTransaction)
- ✅ `/api/wallet/statement/pdf` - Gera extrato (usa WalletTransaction)
- ✅ `/api/wallet/debit` - Débito de saldo (usa Wallet)

---

## 🧪 Testes Necessários (Próximos Passos)

1. **Teste em Sandbox do Mercado Pago:**
   - [ ] Criar pagamento PIX
   - [ ] Escanear QR Code
   - [ ] Verificar webhook recebido
   - [ ] Validar crédito na carteira

2. **Teste de Idempotência:**
   - [ ] Webhook duplicado não credita 2x
   - [ ] Pagamento já aplicado retorna transação existente

3. **Teste de Fluxo Completo:**
   - [ ] Usuário adiciona R$ 100,00
   - [ ] QR Code gerado
   - [ ] Pagamento confirmado
   - [ ] Saldo atualizado em tempo real
   - [ ] Extrato mostra transação correta

4. **Teste de Erros:**
   - [ ] Pagamento cancelado pelo usuário
   - [ ] Pagamento expirado
   - [ ] Erro no webhook (retry)

---

## 📝 Notas Importantes

### Para Desenvolvedores

1. **Nunca mais criar mocks de pagamento no código de produção**
   - Mocks só em testes automatizados
   - Use ambiente sandbox do Mercado Pago para desenvolvimento

2. **Cartão de Crédito (TODO):**
   - Atualmente desabilitado no frontend
   - Implementação futura requer:
     - Payment Brick ou Card Form do Mercado Pago
     - Tokenização no frontend
     - Envio de token para `/api/payments/mercadopago/create`

3. **Confirmação de Pagamentos:**
   - **APENAS via webhook** do Mercado Pago
   - Nunca expor endpoint que permite confirmação manual pelo cliente

### Para QA/Testes

1. **Use credenciais de SANDBOX** do Mercado Pago:
   - Test User: [criar em Mercado Pago DevPanel]
   - Test Cards: fornecidos pelo Mercado Pago
   - Webhooks: usar ngrok ou similar para desenvolvimento local

2. **Validação de Fluxo:**
   - Sempre verificar que pagamento foi REALMENTE processado no dashboard do MP
   - Verificar logs de webhook no backend
   - Confirmar crédito na carteira corresponde ao valor pago

---

## 🎯 Checklist de Conformidade

- [x] Rotas mock de pagamento removidas
- [x] Funções mock de wallet.service.ts removidas
- [x] AddFundsModal usa gateway real
- [x] QR Code PIX vem do Mercado Pago
- [x] Confirmação via webhook (não manual)
- [x] Build passa sem erros
- [x] Zero warnings de ESLint relacionados a mocks
- [x] Documentação atualizada

**Status:** ✅ **CONCLUÍDO**

---

## 📚 Referências

- [Arquitetura Pagamentos/Carteira](../../architecture/payments/architecture-payments-wallet.md)
- [Documentação Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs)
- [Webhooks Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)

---

**Última atualização:** 2024-11-22
**Responsável:** Refatoração automatizada
