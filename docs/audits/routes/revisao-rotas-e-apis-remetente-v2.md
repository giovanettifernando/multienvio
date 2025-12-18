# Revisão de Rotas e APIs – Remetente (Versão 2.0)

## Introdução
Nova revisão técnica do App Router e das APIs/serviços do remetente após as implementações recentes. Foco em rotas usadas pelo remetente, suas dependências, duplicidades, código potencialmente não usado e oportunidades adicionais de padronização.

## Objetivo da revisão
- Atualizar o mapa de rotas/páginas e os principais consumidores de API.
- Inventariar endpoints e serviços relevantes do remetente, destacando integrações.
- Identificar sobreposições, mocks legados e superfícies sem uso claro.
- Listar inconsistências e ações recomendadas para consolidar contratos e domínios.

## Escopo
- **Incluído:** `app/(envio)/**`, páginas públicas de rastreio (`app/rastreio/**`), autenticação do cliente (`app/(auth)/auth/**`), e endpoints em `app/api/**` que atendem o remetente (cotação, checkout, carrinho, envios, coletas, carteira/pagamentos, suporte, rastreio, contas).
- **Excluído:** `app/(admin)/**`, `app/(collector)/**`, `app/api/admin/**`, `app/api/coletores/**`, pontos de coleta e scripts internos, salvo quando afetam fluxos do remetente.

## Mapa de rotas do remetente

| Caminho | Arquivo | Descrição | Principais APIs/serviços usados |
| --- | --- | --- | --- |
| `/` | `app/(envio)/(overview)/page.tsx` | Dashboard com status de envios, quick calculator, wallet, suporte. | `/api/shipments`, `/api/dashboard/pending-pickup-shipments`, `/api/coletas`, `/api/support/tickets`, `/api/wallet`, `/api/account/addresses`. QuickCalculator ainda usa resultados mockados (não chama API real). |
| `/cotacoes` | `app/(envio)/cotacoes/page.tsx` | Formulário de cotação e seleção de serviço. | `/api/cotacoes`, `/api/units`, `/api/cep|geocode`, `/api/account/addresses`, `/api/account/recipients`, `/api/wallet/status`. |
| `/cotacoes/finalizar` | `app/(envio)/cotacoes/finalizar/page.tsx` | Finalização: documentos, destinatário, checkout ou carrinho. | `/api/checkout`, `/api/cart/items`, `/api/account/recipients`, `/api/pickup-fee/calculate`, `/api/account/company`, `/api/pickup-points` (quando selecionado). |
| `/cotar` | `app/(envio)/cotar/page.tsx` | Redirect para `/cotacoes`. | — |
| `/carrinho` | `app/(envio)/carrinho/page.tsx` | Gestão de itens e pagamento do carrinho. | `/api/cart`, `/api/cart/items`, `/api/cart/checkout`, `/api/cart/[id]/unlock`, `/api/payments/mercadopago/*`, `/api/wallet/debit`. |
| `/shipments` | `app/(envio)/shipments/page.tsx` | Lista envios com filtros/status e cancelamento. | `/api/shipments`, `/api/shipments/[id]/cancel`, `/api/shipments/[id]/divergences`, `/api/labels`/`/pdf`. |
| `/shipments/[id]` | `app/(envio)/shipments/[id]/page.tsx` | Detalhe do envio. | `/api/shipments/[id]`, `/api/labels/[id]`/`/pdf`, `/api/payments/*` (quando aplicável). |
| `/coletas` | `app/(envio)/coletas/page.tsx` | Lista de pickup requests do usuário. | `/api/coletas` (Prisma), `/api/dashboard/pending-pickup-shipments`. |
| `/coletas/nova` | `app/(envio)/coletas/nova/page.tsx` | Solicitação manual de coleta. | `/api/account/company`, `/api/shipments`. |
| `/coletas/[id]` | `app/(envio)/coletas/[id]/page.tsx` | Detalhe/simulação de coleta. | `/api/pickups/[id]` (mock em memória), `/api/webhooks/pickups`, `/api/pickups/[id]/manifest`. |
| `/rastreamento` | `app/(envio)/rastreamento/page.tsx` | Lista de rastreios (legacy). | `/api/shipments` (via query). |
| `/rastreamento/[id]` | `app/(envio)/rastreamento/[id]/page.tsx` | Detalhe de rastreio com simulação de eventos. | `/api/tracking` (mock), `/api/webhooks/tracking`, `/api/shipments` (consulta via query string). |
| `/etiquetas` | `app/(envio)/etiquetas/page.tsx` | Histórico de etiquetas e PDFs/cancelamento por volume. | `/api/labels`, `/api/labels/[id]/pdf`, `/api/packages/[id]/cancel|pdf`. |
| `/carteira` | `app/(envio)/carteira/page.tsx` | Saldo, resumo e recarga. | `/api/wallet`, `/api/payments/mercadopago/*`, `/api/wallet/resolve-debt`, `/api/wallet/debit`. |
| `/carteira/extrato` | `app/(envio)/carteira/extrato/page.tsx` | Extrato e downloads. | `/api/wallet/transactions`, `/api/wallet/statement/pdf|download`. |
| `/carteira/faturas` | `app/(envio)/carteira/faturas/page.tsx` | Listagem de faturas. | `/api/invoices`. |
| `/carteira/metodos` | `app/(envio)/carteira/metodos/page.tsx` | Gestão de cartões. | `/api/cards` (alias), `/api/account/cards`. |
| `/minha-conta` | `app/(envio)/minha-conta/page.tsx` | Dados pessoais, endereços, cartões, destinatários, itens recorrentes, segurança. | `/api/account/me|profile|company|addresses*|cards*|recipients*|security/change-password`, `/api/recurring-items*`. |
| `/conta/perfil` | `app/(envio)/conta/perfil/page.tsx` | Placeholder “em desenvolvimento”. | — |
| `/suporte`, `/suporte/novo`, `/suporte/[id]` | `app/(envio)/suporte/**` | Abertura/lista/detalhe de tickets. | `/api/support/tickets*`, `/api/shipments?limit=100`. |
| `/devolucoes` | `app/(envio)/devolucoes/page.tsx` | Placeholder. | — |
| `/rastreio/[code]` (público) | `app/rastreio/[code]/page.tsx` | Rastreamento público. | `/api/public/track/[code]`. |
| `/auth/*` | `app/(auth)/auth/**` | Fluxos de login/cadastro/reset/verificação. | `/api/auth/*`. |

## Inventário de APIs e serviços (remetente)

### Autenticação e Conta
- `app/api/auth/*` – autenticação e ciclo de senha; consumidores: páginas em `app/(auth)/auth/**`.
- `app/api/account/me|profile|password|security/change-password|company` – perfil/empresa; usados em Minha Conta, cotação e coleta.
- `app/api/account/addresses*`, `app/api/account/recipients*`, `app/api/account/cards*`, `app/api/user/preferences` – CRUD de cadastros do usuário; consumidores: Minha Conta, cotação/finalização, pagamentos.
- `app/api/cards` – alias simplificado de `/api/account/cards` (para checkout).

### Cotação, Checkout, Carrinho
- `app/api/cotacoes`, `app/api/cotacoes/[id]`, `app/api/cotacoes/selecionar` – cálculo, listagem, cancelamento e seleção; serviço `lib/quotes/service` (integra Correios + comissão).
- `app/api/checkout` – criação de shipment+label+pickup opcional; integra `createShipmentWithVolumes` e `integrateWithCarrier`.
- `app/api/cart`, `app/api/cart/items`, `app/api/cart/items/[id]`, `app/api/cart/[id]/unlock`, `app/api/cart/checkout` – gestão/checkout em lote do carrinho.
- `app/api/pickup-fee/calculate` – taxa de coleta; usado em finalização.
- `app/api/units` – unidades de postagem (PostingUnitPicker).
- `app/api/packaging` + `[id]` – templates de embalagem; usados em cotação/“Minhas embalagens”.
- `app/api/nfe/parse` – parse de XML da NF-e para os formulários de documento.
- `app/api/services` – lista estática de serviços (mock); consumo não identificado.

### Envios, Etiquetas e Tracking
- `app/api/shipments` (list) e `[id]` (detalhe/delete) – envios do remetente; mapeamento de status UI via `mapToUIStatus`.
- `app/api/shipments/[id]/cancel` – cancelamento com regras de status e estorno de carteira.
- `app/api/shipments/[id]/divergences` – divergências por volume (usado na lista).
- `app/api/shipments/[id]/payment`, `app/api/shipments/payment-batch` – marcação de pagamento; não há consumidores no front atual.
- `app/api/labels*`, `app/api/packages/[id]/cancel|pdf` – gestão de etiquetas/volumes; usados em Shipments/Etiquetas.
- `app/api/tracking` (mock) e `app/api/webhooks/tracking` (simulação) – usados apenas em `/rastreamento/[id]` (UI legacy).
- `app/api/public/track/[code]` – tracking real (público) com `trackingEvents`/`packages`.

### Coletas/Pickups
- `app/api/coletas` – CRUD real via Prisma (pickup requests); usado em `/coletas`.
- `app/api/pickups` + `[id]` + `/manifest` + `app/api/webhooks/pickups` – fluxo mock em memória; usado em `/coletas/[id]`.

### Carteira e Pagamentos
- `app/api/wallet`, `.../status`, `.../transactions`, `.../statement/pdf|download`, `.../debit`, `.../resolve-debt` – carteira/saldo/extrato/débito; usados em Carteira, bloqueios de cotação.
- `app/api/payments/mercadopago/public-key|create|card-saved`, `app/api/payments/methods`, `app/api/payments/charge`, `app/api/payments/[id]/refresh` – integração Mercado Pago para pagamentos imediatos/cartões salvos.
- `app/api/invoices` – faturas; usado em `/carteira/faturas`.

### Suporte
- `app/api/support/tickets*` – tickets do usuário (create/list/detalhe/mensagens/anexos); usado em `/suporte`.

### Cadastros auxiliares e geolocalização
- `app/api/cep`, `app/api/cep/[cep]`, `app/api/geocode` – CEP/geocode; usados em formulários.
- `app/api/dashboard` e `.../pending-pickup-shipments` – cards do overview.
- `app/api/orders*` – pedidos mock em memória; sem uso no front.
- `app/api/faq`, `app/api/faq/[id]/feedback` – FAQ/feedback; nenhum consumidor identificado nas rotas do remetente.
- `app/api/recurring-items*` – itens recorrentes; usados em Minha Conta (aba “Itens recorrentes”).

## Duplicidades / Sobreposições
- **Coletas duplicadas (real x mock).**  
  - APIs: `/api/coletas` (Prisma) vs `/api/pickups/**` (store em memória). Lista de coletas usa a versão real; o detalhe `/coletas/[id]` usa o mock, gerando status/timeline divergentes.  
  - Sugestão: migrar `/coletas/[id]` e componentes para `/api/coletas` e eliminar mocks/webhooks de pickup.

- **Tracking duplicado (mock x real).**  
  - APIs: `/api/tracking` + `/api/webhooks/tracking` (mock) vs `/api/public/track/[code]` (tracking real). `/rastreamento/[id]` usa o mock; `/rastreio/[code]` usa tracking persistido.  
  - Sugestão: expor endpoint autenticado que reutilize o tracking real (mesmo shape do público), apontar `/rastreamento` para ele e remover o mock.

- **Alias de cartões.**  
  - `/api/cards` devolve formato simplificado, `/api/account/cards` é a fonte. Mantêm duas superfícies de contrato.  
  - Sugestão: centralizar em `/api/account/cards` com adaptador no front ou delegação transparente.

- **Pagamentos de shipments em múltiplas superfícies.**  
  - `/api/shipments/[id]/payment` e `/payment-batch` coexistem com `/api/wallet/debit` e webhooks do gateway. Nenhum consumo front identificado.  
  - Sugestão: confirmar legado e consolidar marcação de pagamento na carteira/webhooks; desabilitar ou redirecionar endpoints de payment-*.

- **Detalhe de envio acessado por query na lista.**  
  - `/rastreamento/[id]` busca `/api/shipments?id={id}` (list) em vez de `/api/shipments/[id]`. Pode esconder dados reais ou retornar lista vazia.  
  - Sugestão: ajustar consumidor para o endpoint RESTful ou dar suporte explícito a `id` no list.

- **QuickCalculator com dados mockados.**  
  - Usa mock local em `components/dashboard/QuickCalculator` e não consulta `/api/cotacoes`.  
  - Sugestão: apontar para um endpoint real/light ou sinalizar como sandbox para evitar expectativas erradas de preço/prazo.

## Serviços / APIs potencialmente não utilizados
- `/api/orders*` (mock em memória) – sem referências no front do remetente.
- `/api/services` (lista estática) – consumo não encontrado.
- `/api/shipments/[id]/payment`, `/api/shipments/payment-batch` – sem chamadas identificadas.
- `/api/faq`, `/api/faq/[id]/feedback` – não há rota do remetente consumindo FAQ.
- QuickCalculator (resultado mock) – caminho de produção não validado.
- Pages placeholder: `/conta/perfil`, `/devolucoes`.

## Inconsistências e oportunidades de padronização
- **Vocabulário misto e rotas paralelas:** `shipments` (inglês) vs `coletas` (pt) vs `pickups` (mock); `tracking` mock vs `public/track` real. Definir domínio único (“shipments” + “pickup-requests”) e eliminar aliases de teste.
- **Contratos de resposta diferentes:** `{ items, pagination }`, `{ dados: [...] }`, arrays simples (`/api/cards`). Padronizar para `{ data, pagination }` ou `{ items, meta }` e documentar.
- **Sessão/autenticação heterogênea:** handlers alternam `getSession` e `getUserSessionFromRequest`. Centralizar em um helper para evitar comportamentos distintos (cookies/headers).
- **Mocks em rotas ativas:** `/api/tracking`, `/api/pickups`, `/api/orders`, QuickCalculator. Mover para rotas de sandbox ou remover do menu/UX principal.
- **Campos/payload em PT e EN misturados:** `nome`/`name`, `preco`/`price`, `servico`/`service` coexistem. Escolher padrão (idealmente inglês ou PT consistente) e criar adapters/mappers no serviço.
- **Documento de envio com múltiplos formatos legados:** `packages`, `volumeDeclarations`, `nfeKeys`, `nfeItems`. Centralizar validação/conversão em módulo único para reduzir ramificações nos handlers.
- **Endpoint de detalhe via query na listagem de shipments:** ajustar consumidores para evitar ambiguidade de filtro e reduzir carga do list.

## Status de implementação (atualizado em 04/12/2025)

### ✅ Concluído
- **QuickCalculator integrado à cotação real** – Usa `/api/cotacoes` com React Query e debounce. Resultado mock removido.
- **Alias `/api/cards` consolidado** – Endpoint removido; checkout atualizado para usar `/api/account/cards` diretamente.
- **Placeholders removidos** – `/conta/perfil` e `/devolucoes` excluídos do projeto.
- **Mocks de coleta migrados** – `/api/pickups` e `/api/webhooks/pickups` substituídos por `/api/coletas` real (Prisma).
- **Endpoint de manifesto de coleta** – Criado `/api/coletas/[id]/manifest` para gerar PDF via pdf-lib.
- **Tracking autenticado** – `/api/shipments/[id]/tracking` expõe eventos reais do shipment.

### 🔄 Pendente / Próximos passos
1) **Convergir tracking legado**
   - Ainda existem `/api/tracking` e `/api/webhooks/tracking` (mocks) usados em `/rastreamento/[id]`. Atualizar UI para usar tracking real.

2) **Limpar rotas de payment-* de shipments**
   - Confirmar obsolescência de `/api/shipments/[id]/payment` e `/payment-batch`; consolidar na carteira/webhooks.

3) **Higienizar mocks restantes**
   - `/api/orders` e `/api/services` sem consumidores; considerar remoção.

4) **Padronizar contratos de resposta**
   - Alinhar formato de retorno em APIs (`{ data, pagination }` vs arrays).

## Recomendações de próximos passos (originais)
1) ~~**Unificar coletas no backend real**~~ ✅ Concluído

2) **Convergir tracking no modelo persistido**
   - Expor endpoint autenticado reutilizando `/api/public/track` e atualizar `/rastreamento`/cards para ele; remover `/api/tracking` mock.
   - Benefício: status únicos e eventos reais; menos código duplicado.
   - Risco: garantir cobertura de tracking real para envios legados.

3) ~~**Padronizar respostas e aliases**~~ ✅ Parcial (cards consolidado)
   - Restam outros endpoints para alinhar formato.

4) **Limpar rotas de payment-* de shipments**
   - Confirmar obsolescência de `/api/shipments/[id]/payment` e `/payment-batch`; consolidar na carteira/webhooks.
   - Benefício: superfície menor e menos caminhos de pagamento.
   - Risco: eventuais integrações internas; validar antes de remover.

5) ~~**Ligar QuickCalculator à cotação real**~~ ✅ Concluído

6) ~~**Higienizar mocks/placeholder**~~ ✅ Parcial
   - `/conta/perfil` e `/devolucoes` removidos.
   - Restam `/api/orders`, `/api/services` para avaliação.
