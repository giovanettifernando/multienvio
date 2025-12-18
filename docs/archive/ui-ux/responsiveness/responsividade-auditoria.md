## Resumo executivo
> Arquivo arquivado: Auditoria inicial de responsividade. | Fonte de verdade: `ui-ux/responsiveness/implementacao-responsividade.md`.


> **NOTA (2025-12-11):** Este documento foi a auditoria inicial. A maioria dos problemas listados foi resolvida nas Fases 1-3 da implementação. Ver `ui-ux/responsiveness/implementacao-responsividade.md` para o status atual.

### Status atual (pós-implementação):
- ✅ Container global limitado a 1600px em ultrawide
- ✅ Admin/Collector com sidebar responsiva (200px em 1366, 240px normal) + mobile drawer
- ✅ Todas as tabelas com scrollY para 1366×768
- ✅ Todos os Modals migrados para ELModal
- ✅ Todos os Drawers de formulário migrados para ELDrawer
- ✅ ActionBar substituiu filterBars manuais
- ✅ VolumesGrid responsivo (xs=24, sm=12, md=6)
- ✅ QuoteResultsSection com DataTable + mobile cards

### Problemas originais (referência histórica):
- ~~Há tokens e container global (`app/globals.css`) porém a adoção é parcial~~ → Resolvido
- ~~Fluxos de cotação com tabelas sem fallback mobile~~ → Resolvido
- ~~Listas/tabelas longas não controlam altura visível em 1366×768~~ → Resolvido
- ~~Duplicidade de componentes base (EL* vs Ant Design puro)~~ → Parcialmente resolvido (Modals/Drawers OK)

## Top 10 problemas de responsividade
1. Grid de volumes divide 50/50 mesmo em 360px (inputs ficam com ~150px) em `components/quote/VolumesGrid.tsx` + `app/(envio)/cotacoes/cotacoes.module.css` (`Col xs={12}`), gerando quebra de label/input e necessidade de scroll horizontal no mobile.
2. Resultados de cotação usam `Table` puro sem ellipsis/cards (`components/quote/QuoteResultsSection.tsx`), `scroll={{ x: 700 }}` insuficiente para 5 colunas em 360–412px e sem limite de altura, causando overflow tanto em mobile quanto em 1366×768.
3. Detalhe de envio (`app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`) renderiza múltiplas tabelas aninhadas sem `scroll.x`/ellipsis nos filhos e sem fallback mobile; em 360px os valores quebram linhas e criam scroll horizontal infinito.
4. Container global cresce até 2200–2800px (`app/globals.css`), esticando grids e tabelas em 2560/3440px (ex.: dashboard e cotação) e aumentando a largura de leitura sem limite funcional.
5. Falta de controle de altura útil em 1366×768: `PageShell` sticky + barras de filtros + paginação empurram tabelas para fora da viewport (shipments `app/(envio)/shipments/ShipmentsClient.tsx`, coletas `app/(envio)/coletas/ColetasClient.tsx`, extrato `app/(envio)/carteira/extrato/ExtratoClient.tsx`, admin `app/(admin)/admin/*.tsx`).
6. Modais sem limite de altura/scroll interno quando não usam `ELModal` (ex.: `Modal` em `components/quote/QuoteResultsSection.tsx`, confirmação de cotação/seguro), ultrapassando 768px de altura com formulários ou textos longos.
7. Ações extensas em tabelas sem colapsar em dropdown ou ellipsis: coluna "Ações" com 5 ícones em `app/(envio)/shipments/ShipmentsClient.tsx` e botões longos em admin (`app/(admin)/admin/operacoes/OperacoesClient.tsx`) ocupam >200px e forçam `scroll.x` mesmo em 1366px.
8. Quebra de breakpoints por mistura de sistemas: `ELGrid` (tokens próprios) e `Row/Col` do AntD convivem na mesma tela (ex.: `components/quote/QuoteForm.tsx` com Row/Col e `PageShell` + `ELCard`), causando colapsos diferentes entre 1024/1280/1366.
9. Layouts admin/collector não usam container nem colapso real da sidebar (sider fixo 240px em `app/(admin)/admin/layout.tsx` e `app/(collector)/collector/CollectorLayoutClient.tsx`), deixando pouco espaço em 1366×768/tablet e criando duas barras de scroll.
10. Tipografia/spacing inconsistentes: botões AntD default (ex.: `components/cart/CartTable.tsx`, `components/dashboard/ShipmentsStatusBoard.tsx`) coexistem com `ELButton` (altura 36–44px), gerando desalinhamentos em toolbars e formulários (ex.: `components/account/PersonalForm.tsx` usa padding padrão do AntD).

## Quais páginas quebram em 1366×768
- `/cotacoes` – grid de volumes 2 colunas no xs e resultados em `Table` sem altura limitada causam overflow vertical + horizontal (componentes `QuoteForm.tsx`, `QuoteResultsSection.tsx`).
- `/cotacoes/finalizar` – grid 10/8/6 (`ELGrid` variant `finalizar`) + cards altos e formulário longo ocupam mais que a viewport; sem container de altura para manter botões visíveis (`app/(envio)/cotacoes/finalizar/FinalizarClient.tsx`).
- `/shipments/[id]` – múltiplas tabelas e timeline sem scroll interno (`app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`).
- `/carteira/extrato` – filtros altos + tabela/paginação sem limite de altura (`app/(envio)/carteira/extrato/ExtratoClient.tsx`).
- `/admin/*` e `/collector/*` – sider fixo e conteúdo em 100vh sem max-width nem scroll dedicado (`app/(admin)/admin/layout.tsx`, `app/(collector)/collector/CollectorLayoutClient.tsx`).

## Quais quebram em mobile
- `/cotacoes` – grid de volumes permanece em 2 colunas; tabela de resultados não vira cards (`components/quote/VolumesGrid.tsx`, `QuoteResultsSection.tsx`).
- `/shipments/[id]` – tabelas aninhadas sem modo card/ellipsis (`app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`).
- `/admin/*` e `/collector/*` – sider/header fixos sem drawer; largura útil fica <120px em 360px.
- `/carteira/extrato` – RangePicker + botão + search com min-width 240/300px causam scroll horizontal antes de empilhar (`app/(envio)/carteira/extrato/ExtratoClient.tsx`).

## Quais ficam “esticadas demais” em telas grandes
- Container global expande até 2200–2800px (`app/globals.css`), deixando grids de dashboard, cotação e tabelas (`DataTable`) sem limite de leitura em 2560/3440px.
- Layout admin/collector ocupa toda a largura (sem `max-width`), alongando tabelas e headings (`app/(admin)/admin/layout.tsx`, `app/(collector)/collector/CollectorLayoutClient.tsx`).
- Páginas com `ELGrid` 3/4 colunas (dashboard `app/(envio)/(overview)/OverviewClient.tsx`, Wallet cards `app/(envio)/carteira/CarteiraClient.tsx`) ficam com cards >800px de largura.

## Inventário por rotas/telas
- `/dashboard` (`app/(envio)/(overview)/OverviewClient.tsx`): `PageShell` + `ELGrid` (dashboard/3/2 col). Problemas: cards com inline padding/typography próprios (`components/dashboard/*.tsx`), sem max-width efetivo em ultrawide. Severidade: Médio.
- `/cotacoes` (`app/(envio)/cotacoes/CotacoesClient.tsx`, `components/quote/QuoteForm.tsx`, `QuoteResultsSection.tsx`, `VolumesGrid.tsx`): Layout: `PageShell` > `ELCard` > form (Row/Col) + resultados (`Card` + `Table`). Problemas: 2 colunas em mobile, tabela sem ellipsis/cards, modais de seguro/declaração sem limite de altura. Severidade: Crítico.
- `/cotacoes/finalizar` (`app/(envio)/cotacoes/finalizar/FinalizarClient.tsx`): Layout: `PageShell` > `ELGrid` variant `finalizar` (3 cards) + `forms` grid (2 col) + `RecipientForm`. Problemas: altura/scroll inexistente, muitos tooltips/inputs em linha, botão de pagar fora da viewport em 1366×768. Severidade: Alto.
- `/carrinho` (`app/(envio)/carrinho/CarrinhoClient.tsx`, `components/cart/CartTable.tsx`, `CartSummary.tsx`): Layout: `ELGrid` variant `cart` (2:1). Problemas: tabela desktop sem ellipsis/scroll.x suficiente em textos longos, botões AntD default destoam do `ELButton`. Severidade: Médio.
- `/shipments` (`app/(envio)/shipments/ShipmentsClient.tsx`, `components/ui/DataTable.tsx`): Layout: `PageShell` + `ELCard` + filtros inline + `DataTable` com `scrollX=1200`. Problemas: coluna de ações larga, filtros com min-width fixo, sem altura mínima para viewport baixa. Severidade: Alto.
- `/shipments/[id]` (`app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`): Layout: `PageShell` + cards + 3 tabelas (volumes, itens, eventos) e modais. Problemas: nenhuma responsividade para mobile, sem `scroll.x` nos filhos, risco de overflow vertical/ horizontal. Severidade: Crítico.
- `/coletas` (`app/(envio)/coletas/ColetasClient.tsx`): Layout: `PageShell` + `ELCard` filtros (search, select, RangePicker) + `DataTable` (`scrollX=900`). Problemas: RangePicker min 240px; sem limite de altura; coluna de status larga. Severidade: Alto em 1366×768.
- `/rastreamento` (`app/(envio)/rastreamento/RastreamentoClient.tsx`): Layout: `PageShell` + filtros em dois cards + `DataTable` (`scrollX=900`). Problemas: filtros empilham mas cards ocupam toda largura em mobile; tabela sem ação compactada. Severidade: Médio.
- `/etiquetas` (`app/(envio)/etiquetas/EtiquetasClient.tsx`, `components/labels/LabelsTable.tsx`): Layout: `PageShell` + DataTable com expand row. Problemas: filtros sem breakpoint explícito; expand row desktop usa `Table` sem `scroll.x`; modais PDF sem limite de altura (iframe). Severidade: Médio.
- `/carteira` (`app/(envio)/carteira/CarteiraClient.tsx`): Layout: grid 2 col + tabela. Problemas: grid se estica em ultrawide; cards usam inline sizes. Severidade: Médio.
- `/carteira/extrato` (`app/(envio)/carteira/extrato/ExtratoClient.tsx`, `components/wallet/StatementTable.tsx`): Layout: filtros + grid (resumo + tabela). Problemas: filtros com min-width, sem altura limitada para tabela, paginador fora da viewport em 768px. Severidade: Alto.
- `/carteira/faturas` (`app/(envio)/carteira/faturas/FaturasClient.tsx`): Layout: `PageShell` + botão + DataTable. Problemas: nenhum mobile card para botão; ok em desktop; severidade: Médio-Baixo.
- `/minha-conta` (`app/(envio)/minha-conta/MinhaContaClient.tsx`, `components/account/*`): Layout: `ELGrid` sidebar + tabs. Problemas: forms usam AntD default spacing, inputs largos; em 1366×768 excesso de margem/padding. Severidade: Médio.
- `/suporte` (`app/(envio)/suporte/SuporteClient.tsx`, `components/support/TicketDetailsDrawer.tsx`): Layout: `PageShell` + cards + `ELDrawer`. Problemas: drawer com timeline + upload sem limite de altura; em 768px rolagem dupla. Severidade: Alto.
- `/admin/*` (`app/(admin)/admin/layout.tsx` + páginas): Layout: `Layout` AntD com sider fixo, conteúdo 100% width. Problemas: sem container, tabelas longas sem `scroll.x` consistente, botões default, nenhuma regra para 1366×768. Severidade: Alto.
- `/collector/*` (`app/(collector)/collector/CollectorLayoutClient.tsx` + páginas): Layout: header fixo + sider fixo. Problemas: sem colapso; altura 100vh com overflow oculto; perde espaço em tablets. Severidade: Alto.

## Checklist de padrões problemáticos
- Containers sem max-width ou ignorando `el-container`: `app/(admin)/admin/layout.tsx`, `app/(collector)/collector/CollectorLayoutClient.tsx`, modais PDF em `app/(envio)/etiquetas/EtiquetasClient.tsx`.
- Grids com colunas fixas demais para 1366px: `components/quote/VolumesGrid.tsx` (xs=12 para cada input), `ELGrid` variant `finalizar` (10/8/6) em `app/(envio)/cotacoes/finalizar/FinalizarClient.tsx`.
- Botões/ações sem truncamento: ações em `app/(envio)/shipments/ShipmentsClient.tsx` (5 ícones visíveis), botões de timeline em `components/track/TrackingTimeline.tsx` usam textos longos sem ellipsis.
- Tabelas sem `scroll.x`/ellipsis/colunas flexíveis: `components/quote/QuoteResultsSection.tsx`, tabelas internas de volumes/itens/eventos em `app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`, tabela desktop de `components/cart/CartTable.tsx`.
- Modais sem limite de altura/scroll interno: `Modal` de seguro/declaração em `components/quote/QuoteResultsSection.tsx`, modal PDF com iframe em `app/(envio)/etiquetas/EtiquetasClient.tsx`, confirm dialogs admin (`app/(admin)/admin/operacoes/OperacoesClient.tsx`).
- Uso inconsistente de flex/grid/breakpoints: mix `ELGrid` + `Row/Col` no `QuoteForm.tsx`, forms pickup (`components/pickup/forms/*.tsx`) usam `Row gutter={16}` com spans fixos, enquanto páginas usam `ELGrid` tokens.
- Valores fixos em px que quebram em telas menores: min-width 240/300px em filtros (`app/(envio)/carteira/extrato/ExtratoClient.tsx`, `app/(envio)/coletas/ColetasClient.tsx`), width 280px do sider (`components/layout/Sidebar.tsx`, `app/(admin)/admin/layout.tsx`).

## Componentes que precisam de regra por altura (768px)
- Listagens densas (`app/(envio)/shipments/ShipmentsClient.tsx`, `app/(envio)/coletas/ColetasClient.tsx`, `app/(envio)/carteira/extrato/ExtratoClient.tsx`): compactar filtros, reduzir paddings e aplicar `max-height` com scroll interno para tabela/pagination.
- Detalhe de envio (`app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`): separar colunas em cards e limitar altura das tabelas internas com `scroll.y` e ellipsis.
- Suporte drawer (`components/support/TicketDetailsDrawer.tsx`): adicionar `max-height: calc(100vh - 120px)` com rolagem interna para mensagens/upload.
- Modais de cotação e PDF (`components/quote/QuoteResultsSection.tsx`, `app/(envio)/etiquetas/EtiquetasClient.tsx`): usar `ELModal`/`ELDrawer` com `max-height` e body scroll.
- Admin/collector layouts (`app/(admin)/admin/layout.tsx`, `app/(collector)/collector/CollectorLayoutClient.tsx`): permitir colapso automático do sider e definir área de conteúdo com `overflow-y: auto` em 1366×768.
