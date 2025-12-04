# Plano de padronização e modernização da UI do cliente (Envio Legal) — v2

Revisão após execução inicial: tokens e wrappers foram aplicados em boa parte das telas, novos componentes base (DataTable, ELModal/Drawer, ELAlert, ELStatusTag, ELGrid, PageShell CSS) foram criados, mas nem todos estão em uso. Este v2 destaca o estado atual e o que ainda falta padronizar.

## Visão geral da interface atual
- **Arquitetura**: Next.js (App Router) com grupo `app/(envio)` protegido por `DashboardShell` e `Sidebar`. Tema Ant Design via `ConfigProvider` em `app/layout.tsx`; tokens expostos em CSS vars em `app/globals.css` (cores, espaçamentos, tipografia, status).
- **Páginas principais (remetente)**:
  - `/` (app/(envio)/(overview)/page.tsx): cards de status, resumo e atalhos; segue Row/Col e Cards; ainda com alturas/gutters heterogêneos.
  - `/cotacoes` e `/cotacoes/finalizar`: usam `PageShell`; filtros/formulários com wrappers EL; wizards e modais seguem padrão antigo (sem ELModal).
  - `/carrinho`: filtros e ações em AntD padrão; modais de checkout antigos.
  - `/carteira`/`/carteira/extrato`/`/carteira/faturas`: `PageShell` + wrappers EL em filtros/alerts/botões; tabelas seguem `Table` com estilos via `ELTableWrapper`; modais continuam AntD puro.
  - `/coletas`, `/shipments`, `/rastreamento`: filtros migrados para `ELInput/ELSelect/ELButton` e `ELStatusTag`; tabelas ainda são `Table` + estilos de wrapper; ações seguem botões inline custom.
  - `/etiquetas`: filtros/botões ainda AntD padrão; tabela padrão; modais legados.
  - `/suporte` e `/suporte/[id]/novo`: botões e tags padronizados; Cards com padding manual; Drawer ainda antigo.
  - `/minha-conta`: usa `PageShell` e `ELGrid`; cartões de formulário com AntD.
  - `/rastreio/[code]` (público): passou a usar `ELButton`, `ELAlert`, `ELStatusTag`, mas layout segue inline.
  - `/auth/*`: continuam com wrappers EL e flag `NEW_THEME_ENABLED` agora sempre true (arquivo legado).
- **Componentes transversais**: `PageShell` agora em CSS module com gaps, `ELGrid` para grids responsivos, `ELTableWrapper` para estilizar `Table`, novos componentes base (`ELStatusTag`, `ELAlert`, `ELModal`, `ELDrawer`, `DataTable`) ainda pouco utilizados nas páginas.

## Stack de UI/CSS e tema atual
- **Libs**: Ant Design 6, CSS Modules. Sem Tailwind/Chakra.
- **Tema**: tokens em `lib/ui/theme.ts` e CSS vars em `app/globals.css` (cores primária/secundária, status, neutros, sombras, radius, tipografia, espaçamentos). `NEW_THEME_ENABLED` mantido apenas para compatibilidade, fixo em `true`.
- **Estilos globais**: `app/globals.css` alinha tokens e adiciona variáveis para sidebar/status; `Sidebar.module.css` define cores via tokens; `PageShell.module.css` define header sticky com gaps tokenizados; `ELTableWrapper.module.css` uniformiza tabelas legadas.
- **Tema aplicado**: `ConfigProvider` com `getThemeConfig`; CSS vars cobrem usos fora do tema; sidebar ainda usa var `--color-primary-dark` como fundo (modo brand dark).

## Diretrizes propostas de tema (cores, tipografia, espaçamentos)
- **Cores**: manter paleta já declarada (`primary #003873`, `primary-strong #004a9b`, `secondary #E4660C`, `success #1E8E5A`, `warning #E4660C`, `danger #D64545`, `info #2B6CB0`, neutros bg/surface/border/text). Garantir que componentes e CSS modules consumam tokens em vez de hardcodes restantes (`#dc2626`, `#7c3aed`, `#fef08a` em ações de Shipments; cores de banners e cards inline).
- **Tipografia**: usar vars `--el-font-size-*` e linha base 16px. Escala sugerida (já refletida nas vars): `h1 28-32`, `h2 24`, `h3 20`, `body 16`, `caption 13`, `micro 12`. Aplicar via `Typography`/CSS modules; remover tamanhos inline.
- **Espaçamentos**: vars `--el-spacing-*` já existem; manter `PageShell` com padding 24/16 (desktop/mobile); tabelas com padding via `ELTableWrapper`; grids com gaps via `ELGrid`.
- **Radius/Sombras**: usar `--el-radius-base 12`, `--el-radius-sm 8`, `--el-shadow-soft` e `--el-shadow-subtle`. Remover box-shadows custom em botões/tags manuais (Shipments e afins).

## Padrões de componentes (inventário + plano)
- **Botões**: `ELButton` com variantes `primary/default/link/danger/ghost`; amplamente usado em filtros e ações, mas há botões inline custom em Shipments (ações de linha), Etiquetas e alguns modais. Plano: substituir botões inline por `ELButton` (ou `ELButton` icon-only) com tokens.
- **Inputs/Select/Form**: `ELInput/ELSelect/ELFormItem` usados nas principais telas; QuickCalculator e alguns forms antigos ainda usam AntD puro (checar `components/dashboard/QuickCalculator.tsx`, modais de pagamento/checkout).
- **Cards**: `ELCard` existe, porém Carteira/Extrato/Faturas/Shipments/Coletas/Rastreamento usam `Card` padrão com wrapper CSS. Decidir quando migrar para `ELCard` ou manter `Card`+`ELTableWrapper`.
- **Status/Tags**: `ELStatusTag` e `TicketStatusTag` já aplicados em Shipments, Coletas, Rastreamento, Suporte; mapear quaisquer `Tag` com hardcode de cor remanescente (Etiquetas, dashboards).
- **Alerts/Empty**: `ELAlert` em carteira/faturas/rastreio público; `ELEmpty` ainda pouco usado em tabelas. Padronizar empties em listas.
- **Tabelas**: novo `DataTable` responsivo criado, mas nenhuma página adotou; páginas seguem `Table` com `ELTableWrapper` (Shipments, Coletas, Rastreamento, Faturas, Extrato, Etiquetas). Precisam migrar para aproveitar card-mode mobile.
- **Modais/Drawers**: `ELModal`/`ELDrawer` criados, mas modais (CheckoutModal, CheckoutCartModal, Label modals, StatementPDFModal, TicketDetailsDrawer) continuam AntD puro; padronização pendente.
- **Grids**: `ELGrid` aplicado em Carteira e Minha Conta; outras páginas seguem Row/Col ou CSS inline. Expandir uso.
- **Componentes duplicados/legacy**: `NEW_THEME_ENABLED` ainda importado (agora sempre true); botões inline em Shipments; loaders inline em `LayoutWrapper` ainda existem; `DataTable` sem uso.

## Padrões de layout e grids
- **Container**: `PageShell` com header sticky em CSS module; padding ajustado por tokens. Algumas páginas (suporte, etiquetas, rastreio público) mantêm padding/spacing inline e cards borderless.
- **Listas com filtros**: filtros agora usam wrappers EL e `ELTableWrapper` estiliza tabelas, mas layouts ainda dependem de flex inline; falta toolbar unificada (pretendida no `DataTable`).
- **Grid**: `ELGrid` disponível (grid2/grid3/gridSidebar, etc.) e usado em Carteira e Minha Conta; Overview e Suporte ainda em Row/Col com gutters variados.
- **Sidebar/Header**: cores tokenizadas em `Sidebar.module.css`, porém segue tema dark; Content ainda tem ajustes antigos no `DashboardShell` (altura/overflow) não revisitados.

## Plano de responsividade (desktop e mobile)
- **Melhorias aplicadas**: `ELTableWrapper` reduz padding em mobile; filtros quebram em coluna via CSS; `ELGrid` tem breakpoints para colunas.
- **Pendências críticas**: tabelas de `/shipments`, `/coletas`, `/rastreamento`, `/carteira/extrato`, `/carteira/faturas`, `/etiquetas` ainda dependem de `Table` com `scroll` fixo e ações inline que extrapolam largura; `DataTable` não está implantado. Sidebar dark fixa pode causar overflow em alturas pequenas; loader inline em `LayoutWrapper` mantém altura 100vh.
- **Pendências médias**: Overview com cards de alturas diferentes; suporte/FAQ com padding manual; rastreio público com layout centralizado mas cards inline.
- **Pendências baixas**: placeholders `/devolucoes`, `/conta/perfil` ainda simples.

## Oportunidades de modernização de componentes
- Adotar `DataTable` nas listas principais para card-mode em mobile e toolbar de filtros integrada.
- Trocar botões inline por `ELButton` variantes (icon-only + danger/ghost) e usar `ELStatusTag`/`ELAlert` onde ainda há `Tag`/`Alert` com cores hardcoded.
- Padronizar modais/drawers com `ELModal`/`ELDrawer` (checkout, pagamentos, labels, suporte) e loaders com `ELSkeleton`/`ELAlert` em vez de spinners inline.
- Expandir `ELGrid`/`PageShell` para pages com padding manual (overview, suporte, etiquetas, rastreio público).
- Remover arquivo de flag legado (`NEW_THEME_ENABLED`) dos imports e limpar loaders inline (`LayoutWrapper`, `app/(envio)/layout.tsx` fallback).

## Backlog sugerido (pós-execução v1)
- **Migrar listas para `DataTable`**  
  - Páginas: `app/(envio)/shipments/page.tsx`, `coletas/page.tsx`, `rastreamento/page.tsx`, `carteira/extrato`, `carteira/faturas`, `etiquetas/EtiquetasClient.tsx`.  
  - Benefício: responsividade real e empty/loading padronizados.  
  - Prioridade Alta | Esforço Médio-Alto.
- **Padronizar ações e status**  
  - Páginas: Shipments (ações de linha), Etiquetas (ações/impressão), rastreio público (cards), suporte (cards).  
  - Benefício: consistência visual e acessibilidade; elimina cores hardcoded (`#dc2626`, `#7c3aed`, etc.).  
  - Prioridade Média | Esforço Médio.
- **Padronizar modais/drawers com `ELModal/ELDrawer`**  
  - Páginas: `CheckoutModal`, `CheckoutCartModal`, `LabelPrintModal`, `ShipmentLabelModal`, `StatementPDFModal`, `TicketDetailsDrawer`, modais de carteira.  
  - Benefício: UX previsível e tokens aplicados.  
  - Prioridade Média | Esforço Médio.
- **Aplicar `ELGrid` e ajustar gutters**  
  - Páginas: Overview, Suporte, Etiquetas, Rastreamento público, Shipments/Coletas (filtros + tabela).  
  - Benefício: ritmo visual e responsividade de containers.  
  - Prioridade Média | Esforço Médio.
- **Limpeza de legados**  
  - Itens: remover imports do flag `NEW_THEME_ENABLED`, trocar loaders inline por `ELSkeleton`/`ELAlert`, revisar `DashboardShell` overflow em mobile.  
  - Benefício: redução de dívida e comportamento consistente.  
  - Prioridade Baixa-Média | Esforço Baixo.
