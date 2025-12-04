# Revisão de Rotas e APIs – Aplicação do Remetente

## Introdução
Revisão técnica das rotas do App Router e dos endpoints/serviços usados pelo fluxo principal do remetente. A análise cobre comportamento atual, duplicidades, código possivelmente não usado e oportunidades de padronização.

## Objetivo da revisão
- Mapear rotas/páginas da aplicação do remetente e as APIs/serviços consumidos.
- Inventariar endpoints e serviços de domínio do remetente.
- Identificar sobreposições, dead code e inconsistências de nomenclatura/contratos.
- Sugerir consolidações e próximos passos.

## Escopo
- **Incluído:** rotas em `app/(envio)/**`, rotas de autenticação do cliente (`app/(auth)/auth/**`), rastreio público (`app/rastreio/**`), endpoints em `app/api/**` voltados ao remetente (conta, cotação/checkout/carrinho, envios, carteira, suporte, rastreio, coletas, pagamentos).
- **Excluído:** módulos/Admin (`app/(admin)/**`, `app/api/admin/**`), área de coletores (`app/(collector)/**`, `app/api/coletores/**`), pontos de coleta, materiais explicitamente administrativos ou scripts internos.

## Mapa de rotas da aplicação do remetente

| Caminho | Arquivo | Descrição | Principais APIs/serviços usados |
| --- | --- | --- | --- |
| `/` (Dashboard) | `app/(envio)/(overview)/page.tsx` | Painel com status de envios, calculadora rápida e cards de suporte/carteira. | `/api/shipments` (status), `/api/account/addresses` (QuickCalculator), `/api/wallet`, `/api/support/tickets`, `/api/coletas`, `/api/dashboard/pending-pickup-shipments`. |
| `/cotacoes` | `app/(envio)/cotacoes/page.tsx` | Formulário de cotação com volumes, origem/destino e seleção de serviço. | `/api/cotacoes` (cálculo), `/api/units` (unidades de postagem), `/api/cep`/`/api/geocode`, `/api/account/addresses`, `/api/account/recipients`, `/api/wallet/status` (bloqueio por saldo). |
| `/cotacoes/finalizar` | `app/(envio)/cotacoes/finalizar/page.tsx` | Finalização da cotação: destinatário, documentos, pagamento ou adicionar ao carrinho. | `/api/checkout` (checkout individual), `/api/account/recipients`, `/api/pickup-fee/calculate`, `/api/cart/items` (adicionar), `/api/checkout` (pagar agora), `/api/pickup-points` (quando selecionado), `/api/account/company`. |
| `/cotar` | `app/(envio)/cotar/page.tsx` | Redireciona para `/cotacoes`. | — |
| `/carrinho` | `app/(envio)/carrinho/page.tsx` | Lista itens do carrinho, remove/limpa e inicia pagamento. | `/api/cart`, `/api/cart/items`, `/api/cart/checkout`, `/api/cart/[id]/unlock`, `/api/payments/mercadopago/*`, `/api/wallet/debit`. |
| `/shipments` | `app/(envio)/shipments/page.tsx` | Lista envios com filtros/status e cancelamento. | `/api/shipments`, `/api/shipments/[id]/cancel`, `/api/shipments/[id]/divergences`, `/api/labels` (marcar impressa), `/api/labels/[id]/pdf`. |
| `/shipments/[id]` | `app/(envio)/shipments/[id]/page.tsx` | Detalhe do envio com volumes, tracking e etiqueta. | `/api/shipments/[id]`, `/api/labels/[id]`/`/pdf`, `/api/payments/*` (pagamento quando pendente). |
| `/coletas` | `app/(envio)/coletas/page.tsx` | Lista de coletas solicitadas pelo remetente. | `/api/coletas` (DB), `/api/dashboard/pending-pickup-shipments`. |
| `/coletas/nova` | `app/(envio)/coletas/nova/page.tsx` | Solicitação manual de coleta para envios existentes. | `/api/account/company`, `/api/shipments` (envios elegíveis). |
| `/coletas/[id]` | `app/(envio)/coletas/[id]/page.tsx` | Detalhe/simulação de coleta. | `/api/pickups/[id]` (store em memória), `/api/webhooks/pickups`, `/api/pickups/[id]/manifest` (PDF), `/api/pickups/[id]` (PATCH). |
| `/rastreamento` | `app/(envio)/rastreamento/page.tsx` | Lista rastreamentos (UI legacy). | `/api/shipments` (consulta por query). |
| `/rastreamento/[id]` | `app/(envio)/rastreamento/[id]/page.tsx` | Detalhe de rastreio com adição manual de eventos/webhook. | `/api/tracking` (mock), `/api/webhooks/tracking`, `/api/shipments` (busca por id via query string). |
| `/etiquetas` | `app/(envio)/etiquetas/page.tsx` | Histórico de etiquetas, download/cancelamento de volumes. | `/api/labels`, `/api/labels/[id]/pdf`, `/api/packages/[id]/cancel`/`/pdf`. |
| `/carteira` | `app/(envio)/carteira/page.tsx` | Saldo, resumo e recarga via cartão/Pix. | `/api/wallet`, `/api/wallet/debit`, `/api/payments/mercadopago/*`, `/api/wallet/resolve-debt`. |
| `/carteira/extrato` | `app/(envio)/carteira/extrato/page.tsx` | Extrato completo e download de extratos. | `/api/wallet/transactions`, `/api/wallet/statement/pdf|download`. |
| `/carteira/faturas` | `app/(envio)/carteira/faturas/page.tsx` | Lista de faturas. | `/api/invoices`. |
| `/carteira/metodos` | `app/(envio)/carteira/metodos/page.tsx` | Métodos de pagamento (cartões). | `/api/cards` (alias), `/api/account/cards`. |
| `/minha-conta` | `app/(envio)/minha-conta/page.tsx` | Dados pessoais, endereços, cartões, destinatários, itens recorrentes, segurança. | `/api/account/profile`, `/api/account/company`, `/api/account/addresses*`, `/api/account/cards*`, `/api/account/recipients*`, `/api/recurring-items*`, `/api/account/security/change-password`. |
| `/conta/perfil` | `app/(envio)/conta/perfil/page.tsx` | Placeholder “em desenvolvimento”. | — |
| `/suporte`, `/suporte/novo`, `/suporte/[id]` | `app/(envio)/suporte/**` | Abertura, listagem e detalhe de tickets. | `/api/support/tickets*`, `/api/shipments?limit=100` (vincular envio). |
| `/devolucoes` | `app/(envio)/devolucoes/page.tsx` | Placeholder. | — |
| `/rastreio/[code]` (público) | `app/rastreio/[code]/page.tsx` | Página pública de rastreamento. | `/api/public/track/[code]`. |
| `/auth/*` (login/cadastro/esqueci-senha/verificação) | `app/(auth)/auth/**` | Fluxos de autenticação do remetente. | `/api/auth/*`. |

## Inventário de APIs e serviços (remetente)

### Autenticação e Conta
- `app/api/auth/login|register|verify-email|forgot-password|reset-password|resend-verification|logout|me` (POST/GET). Responsável por autenticação e ciclo de senha; usado pelas páginas em `app/(auth)/auth/**`. Usa `lib/auth/session`, `lib/auth/user-session`, Prisma.
- `app/api/account/me|profile|password|security/change-password` (GET/PATCH). Atualiza dados pessoais/segurança (consumido em Minha Conta).
- `app/api/account/company` (GET). Dados da empresa, usado em cotação e coleta.
- `app/api/account/addresses` + `...[id]` (CRUD). Consumido em Minha Conta, QuoteForm, QuickCalculator.
- `app/api/account/recipients` + `...[id]/make-default` (CRUD). Consumido em cotação/finalização e Minha Conta.
- `app/api/account/cards` + variantes `[id]/make-default|tokenize|create-token-backend` (CRUD/tokenização). Usado em Minha Conta e pagamentos; serviço `lib/services/account-cards.service`.
- `app/api/user/preferences` (GET/PUT). Preferências do usuário (ex.: unidade padrão de postagem), usado por `PostingUnitPicker`.

### Cotação, Checkout, Carrinho
- `app/api/cotacoes` (POST/GET) e `app/api/cotacoes/[id]` (GET/DELETE). Calcula/lista/cancela cotações via `lib/quotes/service` (integração Correios + comissão). Consumidor: `/cotacoes`.
- `app/api/cotacoes/selecionar` (POST). Persistência da seleção de serviço para checkout; usado em `/cotacoes` -> `/cotacoes/finalizar`.
- `app/api/checkout` (POST). Cria shipment + label + tracking inicial e pickup opcional; usa `createShipmentWithVolumes`, `integrateWithCarrier`.
- `app/api/cart` (GET/DELETE), `app/api/cart/items` (POST), `app/api/cart/items/[id]` (PATCH/DELETE), `app/api/cart/[id]/unlock` (PATCH), `app/api/cart/checkout` (POST). Gestão do carrinho e checkout em lote. Consumidores: `/cotacoes/finalizar` (adicionar), `/carrinho`.
- `app/api/pickup-fee/calculate` (POST). Calcula taxa de coleta na origem via `lib/services/pickupFee`; usado na finalização da cotação.
- `app/api/units` (GET). Lista unidades de postagem (consumido por `PostingUnitPicker`).
- `app/api/packaging` + `[id]` (CRUD). Templates de embalagem usados em `QuoteForm` (VolumesGrid) e componentes de “Minhas embalagens”.
- `app/api/services` (GET). Retorna serviços estáticos de frete (`shippingServices`); não há consumidor conhecido em produção.
- `app/api/nfe/parse` (POST). Parser de XML de NF-e para popular itens na cotação.

### Envios, Etiquetas e Tracking
- `app/api/shipments` (GET). Lista envios do remetente com filtros/status.
- `app/api/shipments/[id]` (GET/DELETE). Detalhe completo e deleção condicionada.
- `app/api/shipments/[id]/cancel` (POST). Cancela envio conforme status e reembolsa carteira quando aplicável.
- `app/api/shipments/[id]/divergences` (GET). Lista divergências registradas por volume; usado na lista de envios.
- `app/api/shipments/[id]/payment` (PATCH) e `app/api/shipments/payment-batch` (PATCH). Atualizam status de pagamento; não há uso identificado no front do remetente.
- `app/api/labels` (GET/PATCH), `app/api/labels/[id]` (GET/PATCH/DELETE), `app/api/labels/[id]/pdf` (GET). Gestão de etiquetas; usados em `/shipments` e `/etiquetas`.
- `app/api/packages/[id]/cancel|pdf` (POST/GET). Operações por volume; usados em `/etiquetas`.
- `app/api/tracking` (GET/POST). Mock de tracking em memória (`ensureTracking`), usado apenas pelo rastreamento interno legacy.
- `app/api/public/track/[code]` (GET). Tracking público real via BD, usado em `/rastreio/[code]`.
- `app/api/webhooks/tracking` (POST). Simulação de webhook para inserir eventos; usado em `/rastreamento/[id]`.

### Coletas/Pickups
- `app/api/coletas` (GET/POST). CRUD de `PickupRequest` no BD, filtrando por usuário; usado em `/coletas` (listagem).
- `app/api/pickups` e `app/api/pickups/[id]` (GET/POST/PATCH) + `/manifest`. Implementação mock em memória (`lib/stores/shipments`), usada pelo detalhe `/coletas/[id]` e simulações de webhook. Sobrepõe o domínio de coletas do BD.
- `app/api/webhooks/pickups` (POST). Simula eventos de coleta para UI de detalhe.

### Carteira e Pagamentos
- `app/api/wallet` (GET), `app/api/wallet/status` (GET), `app/api/wallet/transactions` (GET), `app/api/wallet/statement/pdf|download` (GET), `app/api/wallet/debit` (POST), `app/api/wallet/resolve-debt` (POST). Saldo, extrato, débito e regularização; usados em `/carteira` e bloqueios de cotação.
- `app/api/payments/mercadopago/public-key|create|card-saved` (GET/POST), `app/api/payments/methods` (GET), `app/api/payments/charge` (POST), `app/api/payments/[id]/refresh` (POST). Integração com Mercado Pago para pagamento imediato e via cartão salvo; usados em modais de pagamento do carrinho/carteira.
- `app/api/cards` (GET). Alias de `/api/account/cards` retornando formato simplificado para checkout.
- `app/api/invoices` (GET). Lista faturas (usada em `/carteira/faturas`).

### Suporte
- `app/api/support/tickets` (GET/POST), `app/api/support/tickets/[id]` (GET/PATCH), `.../messages` (POST/GET), `.../attachments` (POST). CRUD de tickets, consumido por `/suporte`.

### Cadastros auxiliares e geolocalização
- `app/api/cep` e `app/api/cep/[cep]`, `app/api/geocode` (GET). Consulta CEP/geocodificação; usados em formulários de endereço/cotação.
- `app/api/dashboard` e `app/api/dashboard/pending-pickup-shipments` (GET). Dados do painel; usados em cards de overview.
- `app/api/orders` e `app/api/orders/[id]` (GET/POST/PATCH/DELETE). Mock de pedidos em memória; não há consumidores ativos.

## Duplicidades / Sobreposições identificadas

- **Coletas em duplicidade (BD vs mock em memória).**  
  - Envolvidos: `app/api/coletas/route.ts` (Prisma, status reais) vs `app/api/pickups/**` + `lib/stores/shipments` (mock). UI de lista usa `/api/coletas`, mas o detalhe `/coletas/[id]` consome `/api/pickups`, criando experiências divergentes.  
  - Sugestão: consolidar no modelo real (`/api/coletas`), migrar `/coletas/[id]` para usar o mesmo endpoint/serviço e remover mocks depois.

- **Tracking duplicado (mock interno x tracking real).**  
  - Envolvidos: `/api/tracking` (gera eventos fake) + `/api/webhooks/tracking` vs `/api/public/track/[code]` e tracking armazenado em `Shipment.trackingEvents`. `/rastreamento/[id]` usa o mock, enquanto `/rastreio/[code]` usa dados reais.  
  - Sugestão: expor um endpoint autenticado que reutilize o tracking real (mesmo modelo do público), ajustar `/rastreamento` para usá-lo e eliminar o mock.

- **Cartões duplicados (alias x principal).**  
  - Envolvidos: `/api/cards` (alias simplificado) e `/api/account/cards/**`. Mantêm duas superfícies de contrato.  
  - Sugestão: centralizar em `/api/account/cards` e criar adaptador no front (ou um handler que apenas delega sem alterar shape) para evitar divergência de payload.

- **Endereçamento de detalhes de envios inconsistente.**  
  - UI de `/rastreamento/[id]` busca `/api/shipments?id={id}` (query), enquanto o endpoint de detalhe é `/api/shipments/[id]`. Pode estar sempre caindo no list (sem filtro por id) e ocultando dados reais.  
  - Sugestão: alinhar consumidor para `/api/shipments/[id]` ou adicionar suporte explícito a `id` no list apenas se for necessário.

- **APIs de pagamento em lote de shipments sem consumidores.**  
  - `/api/shipments/[id]/payment` e `/api/shipments/payment-batch` coexistem com `/api/wallet/debit` e fluxos de checkout, mas não são chamados.  
  - Sugestão: confirmar obsolescência e consolidar toda lógica de marcação de pagamento em `/wallet/debit` e webhooks de gateway.

## Serviços / APIs potencialmente não utilizados
- `/api/orders` e `/api/orders/[id]` (mock em memória). Sem referências no front do remetente.
- `/api/services` (lista estática de serviços). Não encontrado consumo na UI.
- `/api/shipments/[id]/payment` e `/api/shipments/payment-batch`. Sem chamadas identificadas no front.
- Pages placeholder sem integração: `/conta/perfil`, `/devolucoes`.
- QuickCalculator em `/` usa resultados mockados (não chama cotação real), indicando UI de teste.

## Inconsistências e oportunidades de padronização
- **Nomenclatura e domínios mistos:** coexistem `/shipments` (inglês), `/coletas` (português), `/pickups` (mock), `/tracking` (mock) e `/public/track` (real). Definir vocabulário único por domínio (p.ex. “shipments” + “pickup-requests”) e remover aliases legados.
- **Padrões de resposta variáveis:** algumas APIs retornam `{ items, pagination }`, outras `{ dados: [...] }` ou arrays simples (`/api/cards`). Padronizar para `{ data, pagination }` ou `{ items, meta }`.
- **Autenticação inconsistente nos handlers:** mistura `getSession` e `getUserSessionFromRequest`; alinhar para um helper único para evitar diferenças de escopo/cookies.
- **Uso de mocks em rotas ativas:** `/api/tracking`, `/api/pickups`, `/api/orders`, QuickCalculator. Substituir por dados reais ou mover para rotas de sandbox internas.
- **Endpoint de detalhe de envio consumido via query string:** ajustar consumidores para rota RESTful `/api/shipments/[id]`.
- **Português x inglês em payloads/campos:** objetos variam entre `nome`/`name`, `preco`/`price`, etc. Padronizar nomenclatura (idealmente inglês ou português consistente) e documentar contrato.
- **Validação/payload duplicados em documentos de envio:** checkout aceita formatos legado e novo (packages, volumeDeclarations). Considerar módulo único de validação/conversão para reduzir ramificações.

## Recomendações de próximos passos
1) **Consolidar coletas no modelo real**  
   - Descrição: migrar `/coletas/[id]` e componentes para consumir `/api/coletas`, desativar `/api/pickups` mocks/webhooks.  
   - Benefício: dados únicos, elimina divergência de status/eventos.  
   - Risco: ajustes de UI e migração de dados de testes; exigir migração de fixtures.

2) **Unificar tracking**  
   - Descrição: criar endpoint autenticado que reutilize tracking real (mesma fonte de `/api/public/track`), apontar `/rastreamento` e cards para ele, remover mock `/api/tracking`.  
   - Benefício: coerência de status e eventos, menos código duplicado.  
   - Risco: necessidade de garantir cobertura de tracking real para envios antigos; cuidado com performance de joins.

3) **Padronizar contratos de resposta**  
   - Descrição: definir shape padrão `{ items, pagination }` ou `{ data, meta }` e aplicar em `/api/cards`, `/api/services`, `/api/orders` (se mantido), `/api/support/tickets`, etc.  
   - Benefício: simplifica clientes e tipagem, reduz adapters.  
   - Risco: quebra de compatibilidade em consumidores existentes; exigir release coordenado do front.

4) **Rever endpoints de pagamento de shipments**  
   - Descrição: confirmar se `/api/shipments/[id]/payment` e `/payment-batch` são legados; se sim, desabilitar ou redirecionar para `/wallet/debit`/webhooks; alinhar UI para usar apenas fontes suportadas.  
   - Benefício: superfície menor e menos caminhos de pagamento divergentes.  
   - Risco: algum fluxo interno pode depender; validar logs antes de remover.

5) **Integrar calculadora rápida à API real de cotação**  
   - Descrição: substituir mocks de `QuickCalculator` por chamada leve a `/api/cotacoes` (ou endpoint dedicado) usando payload mínimo.  
   - Benefício: experiência consistente, evita expectativas diferentes de preço/prazo.  
   - Risco: mais carga na API de cotação; precisa limitar volume e lidar com validação.

6) **Higienizar placeholders e mocks**  
   - Descrição: marcar `/devolucoes`, `/conta/perfil`, `/api/orders`, `/api/services` como “experimental” ou remover do menu; mover mocks para ambiente de demo.  
   - Benefício: reduz confusão e ataque de superfície.  
   - Risco: perda de material de protótipo se ainda usado em demonstrações.
