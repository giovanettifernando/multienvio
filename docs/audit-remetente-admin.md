# Auditoria de Seguranca - Envio Legal (Remetente + /admin)

Escopo: aplicacao Remetente (UI + API usadas por ela) e modulo /admin (UI + /api/admin). Sem alteracoes de codigo.

## Resumo Executivo
|ID|Severidade|Impacto|Probabilidade|Prioridade|Resumo|
|---|---|---|---|---|---|
|F-01|Critical|Perda financeira direta e emissao de envios com custo manipulado|Alta|P0|Checkout/paid shipment aceitam `freightCost`/`totalCost` do client sem recalculo ou validacao de cotacao|
|F-02|Critical|Emissao de etiqueta e confirmacao de pagamento sem comprovacao real|Alta|P0|`/api/shipments/[id]/payment` permite marcar pagamento como aprovado via client|
|F-03|High|Pagamento de terceiros/valor incorreto para liberar envios|Media|P1|`/api/payments/mercadopago/create` permite metadata com `shipmentId(s)` e `applyCheckoutPayment` nao valida ownership/valor|
|F-04|High|Login CSRF (sessao do atacante no navegador da vitima)|Media|P1|Google OAuth state nao e validado contra nonce armazenado no servidor|
|F-05|High|Exposicao de documentos e anexos sensiveis|Media|P1|Uploads ficam em `/public/uploads` e sao servidos publicamente via `/uploads/...`|
|F-06|Medium|Stored XSS em FAQ do suporte (cliente)|Baixa/Media|P2|`dangerouslySetInnerHTML` renderiza resposta de FAQ sem sanitizacao|
|F-07|High|Execucao arbitraria de SQL por admin com permissao ampla|Baixa/Media|P2|Endpoint `/api/admin/sql` usa `$queryRawUnsafe` com permissao CONFIGURACOES|
|F-08|Medium (condicional)|Rotas sem auth no handler dependem de proxy/middleware|Media (se proxy nao ativo)|P2|Alguns endpoints nao validam sessao e dependem do `proxy.ts`|

Observacao: `pnpm audit --json` nao reportou vulnerabilidades nas dependencias.

## Mapa de Superficie de Ataque

### UI Routes - Remetente
- `/` (overview)
- `/cotacoes`, `/cotacoes/finalizar`, `/cotar` (redirect)
- `/carrinho`
- `/pagamentos-pendentes`
- `/carteira`, `/carteira/extrato`, `/carteira/faturas`, `/carteira/metodos`
- `/etiquetas`
- `/shipments`, `/shipments/[id]`
- `/coletas`, `/coletas/nova`, `/coletas/[id]`
- `/suporte`, `/suporte/novo`, `/suporte/[id]`
- `/minha-conta`
- `/rastreamento`, `/rastreamento/[id]`
- Auth: `/auth/login`, `/auth/cadastro`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/confirmacao`
- Publicos relacionados: `/rastreio/[code]`, `/pagar/[token]`

### UI Routes - /admin
- `/admin`, `/admin/login`, `/admin/logout`
- `/admin/contas`, `/admin/contas/[id]`
- `/admin/coletores`, `/admin/coletores/[id]`
- `/admin/pontos-de-coleta`, `/admin/pontos-de-coleta/[id]`
- `/admin/financeiro`, `/admin/financeiro/movimentacoes`, `/admin/financeiro/repasses`, `/admin/financeiro/comissoes`, `/admin/financeiro/despesas`, `/admin/financeiro/relatorios`
- `/admin/operacoes`
- `/admin/usuarios`
- `/admin/correios`
- `/admin/suporte`, `/admin/suporte/[id]`
- `/admin/gateway-pagamento`
- `/admin/servidor-email`
- `/admin/config`, `/admin/config/comissoes`, `/admin/config/correios-agencies`, `/admin/config/google-oauth`, `/admin/config/openrouter`, `/admin/config/sql`, `/admin/config/knowledge-base`

### API Routes - Remetente
Auth:
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/auth/me`
- `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, `/api/auth/resend-verification`
- `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/heartbeat`

Account:
- `/api/account/me`, `/api/account/profile`, `/api/account/company`, `/api/account/security/change-password`
- `/api/account/addresses`, `/api/account/addresses/[id]`
- `/api/account/cards`, `/api/account/cards/[id]`, `/api/account/cards/[id]/make-default`, `/api/account/cards/[id]/tokenize`, `/api/account/cards/[id]/create-token-backend`
- `/api/account/recipients`, `/api/account/recipients/[id]`, `/api/account/recipients/import`, `/api/account/recipients/[id]/make-default`

Cotacoes/Checkout/Carrinho:
- `/api/cotacoes`, `/api/cotacoes/[id]`, `/api/cotacoes/selecionar`
- `/api/checkout`, `/api/cart`, `/api/cart/items`, `/api/cart/items/[id]`, `/api/cart/checkout`, `/api/cart/checkout-paid`, `/api/cart/[id]/unlock`
- `/api/tracking-codes/reserve`, `/api/pickup-fee/calculate`, `/api/pickup-points`
- `/api/nfe/parse`

Envios/Labels/Rastreamento:
- `/api/shipments`, `/api/shipments/[id]`, `/api/shipments/[id]/payment`, `/api/shipments/[id]/cancel`, `/api/shipments/create-paid`
- `/api/labels`, `/api/labels/[id]`, `/api/labels/[id]/pdf`
- `/api/tracking`, `/api/public/track/[code]`
- `/api/dashboard/pending-pickup-shipments`

Carteira/Pagamentos:
- `/api/wallet`, `/api/wallet/status`, `/api/wallet/transactions`, `/api/wallet/statement/pdf`, `/api/wallet/statement/download`, `/api/wallet/debit`, `/api/wallet/resolve-debt`
- `/api/payments/mercadopago/create`, `/api/payments/mercadopago/public-key`
- `/api/payments/[id]`, `/api/payments/[id]/refresh`, `/api/payments/[id]/refund`

Suporte/FAQ:
- `/api/support/tickets`, `/api/support/tickets/[id]`, `/api/support/tickets/[id]/messages`, `/api/support/tickets/[id]/attachments`
- `/api/faq`, `/api/faq/[id]/feedback`

Itens recorrentes:
- `/api/recurring-items`, `/api/recurring-items/[id]`, `/api/recurring-items/import`, `/api/recurring-items/search`

Pagamento pelo destinatario:
- `/api/recipient-payment/create`, `/api/recipient-payment/list`, `/api/recipient-payment/[token]`
- `/api/recipient-payment/create-payment`, `/api/recipient-payment/pay`, `/api/recipient-payment/refresh-status`
- `/api/recipient-payment/resend`, `/api/recipient-payment/cancel`

Uploads/public:
- `/api/uploads/[...path]` (usado pelo rewrite `/uploads/:path*`)

### API Routes - /admin
Auth:
- `/api/admin/auth/login`, `/api/admin/auth/logout`, `/api/admin/auth/me`, `/api/admin/auth/refresh`, `/api/admin/auth/heartbeat`

Usuarios/Permissoes:
- `/api/admin/staff/users`, `/api/admin/staff/users/[id]`, `/api/admin/staff/users/[id]/status`, `/api/admin/staff/users/[id]/reset`

Clientes:
- `/api/admin/clients`, `/api/admin/clients/[id]`, `/api/admin/clients/[id]/details`, `/api/admin/clients/[id]/profile`
- `/api/admin/clients/[id]/addresses`, `/api/admin/clients/[id]/addresses/[addressId]`
- `/api/admin/clients/[id]/cards`, `/api/admin/clients/[id]/cards/[cardId]`
- `/api/admin/clients/[id]/recipients`, `/api/admin/clients/[id]/recipients/[recipientId]`
- `/api/admin/clients/[id]/wallet`, `/api/admin/clients/[id]/wallet/adjust`
- `/api/admin/clients/[id]/recurring-items`, `/api/admin/clients/[id]/recurring-items/[itemId]`
- `/api/admin/clients/block`, `/api/admin/clients/unblock`, `/api/admin/clients/reset-password`

Pontos de coleta / Coletores:
- `/api/admin/pickup-points`, `/api/admin/pickup-points/[id]`, `/api/admin/pickup-points/[id]/status`, `/api/admin/pickup-points/[id]/reset-password`, `/api/admin/pickup-points/[id]/receptions`
- `/api/admin/coletores`, `/api/admin/coletores/[id]`, `/api/admin/coletores/[id]/status`, `/api/admin/coletores/[id]/reset-password`, `/api/admin/coletores/[id]/pickups`

Operacoes:
- `/api/admin/ops/shipments`, `/api/admin/ops/shipments/[id]`, `/api/admin/ops/shipments/[id]/timeline`, `/api/admin/ops/shipments/[id]/pickup-request`, `/api/admin/ops/shipments/[id]/reprocess`
- `/api/admin/ops/pickups`, `/api/admin/ops/collectors`, `/api/admin/ops/receptions`, `/api/admin/ops/kpis`, `/api/admin/ops/exceptions`

Financeiro:
- `/api/admin/finance/summary`, `/api/admin/finance/ledger`, `/api/admin/finance/ledger/reconcile`, `/api/admin/finance/ledger/adjustment`
- `/api/admin/finance/reports`, `/api/admin/finance/reports/dre`, `/api/admin/finance/reports/accounts-payable`
- `/api/admin/finance/reconciliation`, `/api/admin/finance/reconciliation/mark`
- `/api/admin/finance/expenses`, `/api/admin/finance/expenses/[id]`
- `/api/admin/finance/expense-templates`, `/api/admin/finance/expense-templates/[id]`
- `/api/admin/finance/commissions`, `/api/admin/finance/commissions/[id]/approve`, `/api/admin/finance/commissions/[id]/paid`
- `/api/admin/finance/invoices`, `/api/admin/finance/invoices/[id]/paid`, `/api/admin/finance/invoices/[id]/cancel`
- `/api/admin/finance/payouts`, `/api/admin/finance/payouts/[id]/paid`
- `/api/admin/finance/chargebacks`, `/api/admin/finance/chargebacks/[id]`
- `/api/admin/finance/wallet-transactions`, `/api/admin/finance/carrier-payouts`, `/api/admin/finance/profile-commissions`

Integracoes/Config:
- `/api/admin/payment-gateway/config`, `/api/admin/payment-transactions/pending`, `/api/admin/payment-transactions/sync`, `/api/admin/payment-transactions/[id]/force-approve`
- `/api/admin/integrations/mercadopago`, `/api/admin/integrations/mercadopago/test-webhook`
- `/api/admin/integrations/correios`, `/api/admin/integrations/correios/test`, `/api/admin/integrations/correios/rotulo`
- `/api/admin/correios-agencies`, `/api/admin/correios-agencies/sync`
- `/api/admin/config/faq`, `/api/admin/config/faq/[id]`, `/api/admin/config/comissoes`
- `/api/admin/config/google-oauth`, `/api/admin/config/google-oauth/test`
- `/api/admin/config/openrouter`, `/api/admin/config/openrouter/models`, `/api/admin/config/openrouter/test`, `/api/admin/config/openrouter/playground`
- `/api/admin/knowledge-base`, `/api/admin/knowledge-base/[id]`
- `/api/admin/sql`
- `/api/admin/email-config`, `/api/admin/email-config/test-connection`, `/api/admin/email-config/send-test`
- `/api/admin/fipe/brands`, `/api/admin/fipe/models`, `/api/admin/fipe/sync`
- `/api/admin/ceps/list-manual-overrides`, `/api/admin/ceps/list-low-precision`, `/api/admin/ceps/manual-update`, `/api/admin/ceps/force-regeocode`
- `/api/admin/support/tickets`, `/api/admin/support/tickets/[id]`, `/api/admin/support/tickets/[id]/assign`, `/api/admin/support/tickets/[id]/reply`, `/api/admin/support/tickets/[id]/status`

### Middlewares/Protecoes
- Protecao centralizada em `proxy.ts` (verificacao de cookies, tokenVersion, idle timeout, roteamento de protecao) - `proxy.ts:447`.
- Regras de rotas publicas/auth em `modules/auth/application/route-protection.ts`.
- Nao foi encontrado `middleware.ts` (validar se `proxy.ts` esta realmente conectado ao pipeline do Next).

## Achados

### Tabela resumida
|ID|Severidade|Categoria|Onde (arquivo/rota)|Impacto|Exploit/Abuso|Evidencia|Recomendacao|
|---|---|---|---|---|---|---|---|
|F-01|Critical|Regras de negocio / Integridade financeira|`/api/checkout`, `/api/shipments/create-paid`, `/api/recipient-payment/create`|Usuario manipula preco e cria envio com custo menor ou zero|Enviar payload com `freightCost`/`totalCost` abaixo do real; sistema emite etiqueta e registra pagamento|`app/api/checkout/route.ts:148`, `modules/cart/application/checkout.service.ts:308`, `app/api/shipments/create-paid/route.ts:118`, `modules/shipments/application/create-paid-shipment.service.ts:117`, `modules/recipients/application/service.ts:82`|Recalcular preco no server (quoteId/selection), ignorar valores do client, validar expiracao/ownership da cotacao|
|F-02|Critical|AuthZ / Pagamento|`/api/shipments/[id]/payment`|Marcar envio como pago e emitir etiqueta sem pagamento real|Chamar PATCH com `status=approved` e `method` arbitrarios|`app/api/shipments/[id]/payment/route.ts:20`|Remover endpoint publico ou exigir comprovacao server-side (webhook/assinatura) e ownership do pagamento|
|F-03|High|IDOR / Pagamentos|`/api/payments/mercadopago/create` + `applyCheckoutPayment`|Pagamento de terceiros ou valor incorreto libera envios|Definir metadata `shipmentId(s)` e pagar valor minimo para liberar envios de outro usuario|`app/api/payments/mercadopago/create/route.ts:95`, `platform/integrations/mercadopago/payments.ts:316`|Validar ownership e valor do shipment no server antes de aplicar efeitos; usar referenceId interno e lookup em DB|
|F-04|High|Authn (OAuth)|`/api/auth/google/callback`|Login CSRF / sessao do atacante no navegador da vitima|Atacante cria auth flow e injeta `code` com state forjado|`modules/auth/application/google-oauth.ts:206`, `modules/auth/application/google-oauth.ts:247`, `app/api/auth/google/callback/route.ts:303`|Armazenar nonce/state em cookie/Redis e validar no callback (single-use); rejeitar state desconhecido|
|F-05|High|Exposicao de dados|`/uploads/*` (support/expenses)|Qualquer pessoa com URL acessa anexos e comprovantes|Enumeracao/leak de URLs de anexos|`app/api/uploads/[...path]/route.ts:31`, `platform/storage/support-attachments.ts:5`, `platform/storage/expense-receipts.ts:5`|Mover arquivos para storage privado e servir via endpoint autenticado ou URLs assinadas com expiracao|
|F-06|Medium|XSS (Stored)|FAQ de suporte|Script injetado em respostas de FAQ pode executar no browser do cliente|Admin insere HTML malicioso em FAQ|`modules/support/ui/components/SupportFAQ.tsx:130`|Sanitizar HTML (allowlist) ou renderizar como texto; armazenar somente markdown e converter no server|
|F-07|High|Admin / Acesso privilegiado|`/api/admin/sql`|Execucao arbitraria de SQL com impacto total|Admin com permissao CONFIGURACOES executa DROP/SELECT de dados sensiveis|`app/api/admin/sql/route.ts:29`|Restringir a super-admin + MFA; permitir apenas queries readonly; exigir aprovacao/justificativa e audit log detalhado|
|F-08|Medium (condicional)|Protecao de rotas|Dependencia de `proxy.ts`|Rotas sem auth no handler ficam publicas se proxy nao estiver ativo|Acessar endpoints como `/api/nfe/parse` ou `/api/pickup-points` sem cookie|`proxy.ts:447`, `app/api/nfe/parse/route.ts:324`, `app/api/pickup-points/route.ts:16`|Garantir middleware ativo; adicionar verificacao de sessao nos handlers mais sensiveis como defesa em profundidade|

### Detalhes por item

#### F-01 - Manipulacao de preco no checkout/paid shipment/recipient payment
- Onde: `app/api/checkout/route.ts:148`, `modules/cart/application/checkout.service.ts:308`, `app/api/shipments/create-paid/route.ts:118`, `modules/shipments/application/create-paid-shipment.service.ts:117`, `modules/recipients/application/service.ts:82`
- Evidencia: o payload do client inclui `freightCost`, `estimatedDays`, `totalCost` e e usado diretamente para criar shipment/label e debitar carteira.
- Exploit/Abuso: alterar valores no client (DevTools/proxy) e criar envios com custo menor; ou gerar link de pagamento ao destinatario com valor incorreto.
- Impacto: perda financeira, distorcao de comissoes e contabilidade.
- Recomendacao: recalcular no server com base na cotacao salva/selecionada; validar `quoteId` pertence ao usuario e nao expirou; ignorar valores monetarios do client.

#### F-02 - Confirmacao de pagamento via client
- Onde: `app/api/shipments/[id]/payment/route.ts:20`
- Evidencia: o handler usa `status` e `method` do body para atualizar shipment e emitir label sem validar comprovacao de pagamento.
- Exploit/Abuso: usuario chama PATCH com `status=approved`, liberando etiqueta sem pagamento.
- Impacto: emissao indevida de etiquetas e fraude.
- Recomendacao: remover ou restringir a um fluxo interno; exigir referencia de pagamento validada pelo server (webhook/assinatura); validar ownership do pagamento e estado atual.

#### F-03 - Metadata de pagamento sem ownership
- Onde: `app/api/payments/mercadopago/create/route.ts:95`, `platform/integrations/mercadopago/payments.ts:316`
- Evidencia: metadata fornecida pelo client define `type=checkout_payment` e `shipmentId(s)`; `applyCheckoutPayment` atualiza shipments sem verificar dono ou valor.
- Exploit/Abuso: usuario paga valor baixo e marca envios de outro usuario como pagos; ou marca envios proprios com valor menor.
- Impacto: fraude financeira e quebra de segregacao entre contas.
- Recomendacao: vincular pagamento a um registro interno (quote/checkout) e validar ownership/valor; recusar se `shipmentId` nao pertence ao pagador.

#### F-04 - OAuth state sem validacao real
- Onde: `modules/auth/application/google-oauth.ts:206`, `modules/auth/application/google-oauth.ts:247`, `app/api/auth/google/callback/route.ts:303`
- Evidencia: `state` e apenas base64 JSON; nao ha armazenamento/checagem de nonce.
- Exploit/Abuso: login CSRF (forcar vitima a autenticar na conta do atacante).
- Impacto: sequestro de sessao e confusao de identidade.
- Recomendacao: gerar state + nonce e armazenar em cookie/Redis; validar e invalidar no callback; expirar rapidamente.

#### F-05 - Uploads publicos com dados sensiveis
- Onde: `app/api/uploads/[...path]/route.ts:31`, `platform/storage/support-attachments.ts:5`, `platform/storage/expense-receipts.ts:5`
- Evidencia: anexos e comprovantes sao salvos em `public/uploads/...` e servidos sem auth via `/uploads/...`.
- Exploit/Abuso: acesso nao autorizado se URL vazar ou for enumerada.
- Impacto: exposicao de PII, comprovantes financeiros e documentos.
- Recomendacao: mover para storage privado; servir via endpoint autenticado/URL assinada com expiracao; adicionar controle por ticket/conta.

#### F-06 - Stored XSS em FAQ
- Onde: `modules/support/ui/components/SupportFAQ.tsx:130`
- Evidencia: `dangerouslySetInnerHTML` com `item.answer` sem sanitizacao.
- Exploit/Abuso: inserir HTML/JS em resposta de FAQ via admin/config e executar no browser do cliente.
- Impacto: roubo de sessao, phishing interno, desvio de fluxo.
- Recomendacao: sanitizar HTML (allowlist) ou renderizar markdown/texte seguro no server.

#### F-07 - Endpoint SQL perigoso
- Onde: `app/api/admin/sql/route.ts:29`
- Evidencia: uso de `$queryRawUnsafe` com input direto do admin.
- Exploit/Abuso: execucao de comandos destrutivos ou exfiltracao de dados por conta comprometida.
- Impacto: perda de integridade/confidencialidade total.
- Recomendacao: restringir a super-admin + MFA, permitir somente SELECT, exigir aprovacao/justificativa e registrar auditoria completa.

#### F-08 - Dependencia do proxy para auth (condicional)
- Onde: `proxy.ts:447`, `app/api/nfe/parse/route.ts:324`, `app/api/pickup-points/route.ts:16`
- Evidencia: alguns handlers nao fazem `getUserFromRequest`; protecao depende do `proxy.ts`.
- Exploit/Abuso: se o proxy nao estiver ativo, endpoints tornam-se publicos.
- Impacto: exposicao de dados e abuso de servicos.
- Recomendacao: confirmar integracao do proxy; adicionar verificacoes de sessao em endpoints mais sensiveis (defesa em profundidade).

## Verificacoes de Regras de Negocio

Fluxos criticos (Remetente):
- Cotacao -> Checkout -> Pagamento: valores monetarios sao aceitos do client (`/api/checkout`, `/api/shipments/create-paid`). Possivel subfaturamento e emissao de labels com custo reduzido.
- Pagamento por carteira: `/api/shipments/[id]/payment` permite aprovar e emitir label sem comprovacao (bypass).
- Pagamento MercadoPago: metadata client-side pode referenciar `shipmentId` sem validacao de ownership/valor; `applyCheckoutPayment` atualiza envios direto.
- Pagamento pelo destinatario: criacao do request usa valores de cotacao enviados pelo client (sem recalculo).
- Cancelamentos: ha checagem de ownership e status (parece OK), mas depende da integridade dos status anteriores.

Fluxos criticos (/admin):
- Configuracoes e integracoes: endpoint de SQL permite poder total com permissao CONFIGURACOES.
- Financeiro/ajustes: permissao e verificada, mas revogacao de permissoes nao invalida tokens ativos imediatamente (risco operacional).

## Checklists (OK / RISCO / NA)
- Autenticacao (cookies, access/refresh, tokenVersion): OK
- Autorizacao/tenant (ownership e RBAC): RISCO (pagamento/checkout/metadata)
- Rotas privadas protegidas em server: RISCO (dependencia do proxy em alguns handlers)
- Validacao de entrada (Zod/whitelist): OK (com excecoes em regras de negocio)
- CSRF em endpoints state-changing: RISCO (protecao explicita so em auth)
- XSS: RISCO (FAQ)
- SSRF: NA (nenhum fetch com URL controlavel encontrado no escopo)
- Uploads: RISCO (arquivos em `/public/uploads`)
- Rate limiting em login/checkout: OK (com gaps fora do core)
- Headers de seguranca (CSP/HSTS/etc): OK (headers em `next.config.ts`)
- Dependencias: OK (`pnpm audit --json` sem achados)

## Plano de Acao Sugerido (priorizado)
1) Bloquear manipulacao de preco (P0)
   - Recalcular `freightCost/totalCost` no server usando `quoteId` + selecao salva.
   - Ignorar valores monetarios do client em `/api/checkout`, `/api/shipments/create-paid` e recipient-payment.
2) Remover/fechar `/api/shipments/[id]/payment` (P0)
   - Substituir por webhook/confirmacao server-side com assinatura.
3) Validar pagamentos MercadoPago por ownership/valor (P1)
   - Vincular `paymentTransaction` a um checkout interno e validar `shipmentId(s)`.
4) Corrigir OAuth state (P1)
   - State armazenado em cookie/Redis e validado no callback; single-use.
5) Proteger uploads (P1)
   - Storage privado + URLs assinadas; remover `/public/uploads` para arquivos sensiveis.
6) Sanitizar FAQ (P2)
   - Markdown + sanitizacao allowlist antes de renderizar.
7) Endurecer `/api/admin/sql` (P2)
   - Restringir a super-admin + MFA; readonly; audit log completo.

Quick wins:
- Adicionar validacao server-side de ownership/valor antes de aplicar `applyCheckoutPayment`.
- Trocar `dangerouslySetInnerHTML` por render seguro (markdown sanitizado) no FAQ.
- Adicionar `getUserFromRequest` em `/api/nfe/parse` e `/api/pickup-points` como defesa em profundidade.

## Apendice

### Endpoints analisados (consolidado)
- Remetente: auth, account, cart/checkout, cotacoes, shipments/labels, wallet/payments, support, recipient-payment, uploads, nfe/parse.
- Admin: auth, staff/users, clients, pickup-points/coletores, ops, financeiro, integracoes, configuracoes, suporte, SQL.

### Observacoes de logging/monitoramento
- `withApiHandler` adiciona `requestId` e logs padronizados (bom para correlacao).
- Alguns logs incluem dados de negocio (email, tracking). Verificar politica de mascaramento de PII em producao.

### Itens a validar manualmente
- Confirmar se `proxy.ts` esta registrado como middleware/proxy no runtime do Next (nao ha `middleware.ts`).
- Verificar se endpoints sem auth no handler (`/api/nfe/parse`, `/api/pickup-points`) ficam protegidos em producao.
- Validar integridade do fluxo de pagamento MercadoPago (webhooks, idempotencia, reconciliacao).
- Confirmar que `JWT_SECRET`/`ADMIN_JWT_SECRET` estao definidos em producao.
- Testar acesso direto a `/uploads/...` com anexos reais (suporte, despesas) e avaliar impacto.
