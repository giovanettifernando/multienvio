# Plano de padronização e modernização da UI do cliente (Envio Legal)

## Visão geral da interface atual
- **Arquitetura**: Next.js (App Router) com grupo `app/(envio)` protegido pelo `DashboardShell` (`components/layout/dashboard-shell.tsx`) e sidebar fixa (`components/layout/Sidebar.tsx`). Tema Ant Design aplicado via `ConfigProvider` em `app/layout.tsx` com tokens de `lib/ui/theme.ts`.
- **Páginas principais (remetente)**:
  - `/` (app/(envio)/(overview)/page.tsx): cards de status e resumo (`ShipmentsStatusBoard`, `ShipmentsSummaryCard`), calculadora rápida (`QuickCalculator`), carteira (`WalletCard`/`WalletRecent`), suporte (`SupportQuickView`), coletas (`PickupSchedule`, `PendingPickupPointShipments`) usando `Row/Col` e `Card`.
  - `/cotacoes` (app/(envio)/cotacoes/CotacoesClient.tsx): `PageShell` + `ELCard`, `QuoteForm`; estados de skeleton e empty com `ELSkeleton`/`ELEmpty`.
  - `/cotacoes/finalizar`: fluxo de checkout com `DocumentChooser`, `PostingUnitPicker`, `RecipientForm`, `QuoteNavigationButtons`, `CheckoutModal`; mistura de `Card`, `Row/Col`, botões padrão.
  - `/carrinho`: `PageShell` + `CartTable`, `CartSummary`, modais (`RemoveItemModal`, `CheckoutCartModal`); `Row/Col` com gutter 24.
  - `/carteira`: `PageShell` + `BalanceCard`, `MonthlySummaryCard`, `TransactionsTable` em `Card`; alert inicial com `Typography.Link`.
  - `/carteira/extrato`: filtros (`RangePicker`, `Search`), `PeriodSummaryCard`, `StatementTable`, `StatementPDFModal` em `Card`.
  - `/carteira/faturas`: `Alert` informativo, `Button` primário, `Card` com `Table`, `Modal` para gerar fatura.
  - `/carteira/metodos`: gestão de cartões (não aberto aqui, segue padrão `Card` + tabelas e modais).
  - `/coletas`: filtro manual (Input, Select, RangePicker) + `Table` com `Tag`; `Card` simples.
  - `/coletas/nova`: `PickupWizard` em `PageShell`; fallback `Skeleton` ou mensagem de cadastro.
  - `/shipments`: `PageShell` + `Table` extensa com `Tag`, `Modal` de divergência, ação inline customizada; muitas `Button`/`Tooltip`.
  - `/shipments/[id]`: detalhes com `Descriptions`/`Card` (layout simples).
  - `/etiquetas`: `PageShell` + `LabelsTable`, modais (`LabelPrintModal`, `ShipmentLabelModal`), `Spin` de carregamento.
  - `/rastreamento`: filtros (Input.Search + `Tag`), `Table` com `TrackingStatusTag`.
  - `/rastreamento/[id]`: timeline (`TrackingTimeline`), dados em `Card`/`Row`; usa `PageShell`.
  - `/suporte`: `PageShell` + `SupportFAQ`, `NewTicketList`, `TicketDetailsDrawer`; botões primários e borderless `Card`.
  - `/suporte/novo`: `PageShell` com `SupportForm` dentro de `Card`, container centralizado.
  - `/suporte/[id]`: `PageShell` + `TicketDetailsContent` em `Card`.
  - `/minha-conta`: `PageShell` + grid (CSS module) com `Card` (`PersonalForm`, `AccountTabs`).
  - `/conta/perfil` e `/devolucoes`: placeholders simples (div + h1/p).
  - `/rastreio/[code]` (público): `Card`, `Tag`, `TrackingTimeline`, `PublicShipmentItems`; estilos inline.
  - `/auth/*`: login/cadastro/esqueci-senha usando `FormCard`, `ELInput`, `ELFormItem`, `ELButton`; ainda condicionais por `NEW_THEME_ENABLED`.
- **Componentes transversais**: `PageShell` (cabeçalho fixo azul), `PageHeader`, wrappers EL (`ELButton`, `ELCard`, `ELInput`, `ELSelect`, `ELFormItem`, `ELTag`, `ELSkeleton`, `ELEmpty`), status tags (`TrackingStatusTag`, `PickupStatusTag`), tabelas específicas (`LabelsTable`, `CartTable`, `StatementTable`, `ShipmentsStatusBoard`).

## Stack de UI/CSS e tema atual
- **Libs de UI/CSS**: Ant Design 6 (`@ant-design/icons`), CSS Modules, sem Tailwind/Chakra. Sem lib de animação ou design system externo.
- **Tema**: tokens centralizados em `lib/ui/theme.ts` (cores primária #003873, warning #E4660C, success #1E8E5A, error #D64545, radius 12, sombra `rgba(0, 56, 115, 0.12)`, espaçamentos `spacing`). Aplicado via `ConfigProvider` em `app/layout.tsx` com `AntdRegistry`. CSS vars duplicadas em `app/globals.css` (`--color-primary`, `--color-secondary`, `--el-radius-base`, etc.).
- **Estilos globais**: `app/globals.css` (cores base, fonte Inter, reset), estilos globais embutidos no `Sidebar` (`components/layout/Sidebar.tsx` via `<style jsx global>`), além de classes `.app-header*` legadas.
- **Tema condicional**: alguns wrappers ainda checam `NEW_THEME_ENABLED` (`components/ui/ELButton.tsx`, `app/(auth)/auth/login/LoginClient.tsx`, etc.), gerando bifurcação de estilos.
- **Fonte**: Inter carregada via `next/font` e aplicada com variável `--font-inter`.

## Diretrizes propostas de tema (cores, tipografia, espaçamentos)
- **Cores (tokens semânticos)**: padronizar e nomear em `lib/ui/theme.ts` + CSS vars.
  - `primary: #003873` (já usado), `primary-strong: #004a9b`, `secondary: #E4660C`, `secondary-soft: #F6D4B8`.
  - `success: #1E8E5A`, `warning: #E4660C`, `danger: #D64545`, `info: #2B6CB0`.
  - Neutros: `bg-base: #F7F8FA`, `surface: #FFFFFF`, `text: #182235`, `muted: #4A6076`, `border: #CFD8E6`.
  - Mapear hardcodes: substituir `#0A2955` (sidebar), `#1890ff` (loaders), `#dc2626` (alertas manuais), `#e2e8f0/#f8fafc` (cotacoes.module.css) por tokens equivalentes.
- **Tipografia**: manter Inter, base 16px. Escala sugerida: `display-1 32/38`, `h1 28/34`, `h2 24/30`, `h3 20/26` (PageShell usa h3), `body 16/24`, `caption 13/18`, `micro 12/16`. Documentar em `lib/ui/theme.ts` e aplicar via `Typography` presets.
- **Espaçamentos**: reaproveitar `spacing` existente (`xs 4, sm 8, md 12, lg 16, xl 24, xxl 32`). Definir uso: `PageShell` gap default = `xl`; gutters de grid padrão `md` (12) para mobile e `lg` (16/24) para desktop; padding de containers/cards `lg` (16).
- **Radius e sombras**: radius padrão 12px; controles 8px (inputs/selects/botões). Sombras: `soft: 0 20px 48px rgba(0,56,115,0.12)` para cards destacados, `subtle: 0 4px 12px rgba(0,0,0,0.05)` para hover/menus. Remover inline box-shadows custom (ex.: botão de divergência em `app/(envio)/shipments/ShipmentsClient.tsx`).
- **Centralização**: consolidar variáveis em `lib/ui/theme.ts` e referenciar via `theme.useToken` nos componentes; alinhar `app/globals.css` para apontar para os mesmos valores e remover duplicatas legadas.

## Padrões de componentes (inventário + plano de padronização)
- **Botões**: hoje mistura `Button` padrão AntD, `ELButton` (condicional) e botões “na mão” (ex.: divergência em `shipments`, filtros em `coletas`, `PublicTrackingClient`). Plano: usar `ELButton` como default (variants `primary/default/link`) e mapear usos divergentes (Shipments, Rastreamento, Coletas, Carteira/Faturas, Support, Public Tracking, Auth) para o wrapper. Criar variante `danger`/`ghost` no `ELButton` em `components/ui` para evitar hardcode de cores.
- **Cards**: `ELCard` existe, mas páginas como Carteira, Extrato, Faturas, Coletas, Shipments, Rastreamento, Suporte usam `Card` cru/variant borderless. Padronizar com `ELCard` (header opcional) ou criar `Surface` light sem sombra para seções secundárias. Ajustar `PageShell` para aceitar `containerWidth` (p.ex. `maxWidth` para formulários) e reduzir necessidade de divs com margin manual (ex.: `suporte/novo`).
- **Inputs/Selects/Form**: `ELInput`, `ELSelect`, `ELFormItem` cobrem altura/radius tokens, mas várias telas usam `Input`/`Select` default (`coletas`, `shipments`, `rastreamento`, `PublicTrackingClient`, `QuickCalculator`, `Extrato`). Plano: migrar filtros e formulários para wrappers EL e remover `NEW_THEME_ENABLED` do login e campos de auth.
- **Grids/Listas**: Row/Col com gutters variados (12, 16, 24) e flex inline. Criar helpers de layout (`Stack`, `Grid` simples) ou documentar guidelines de gutter por breakpoint. Revisar `PageShell` sticky header para mobile (top 0 com padding) e garantir padding horizontal consistente (`24px` desktop, `16px` mobile).
- **Tabelas**: múltiplas implementações com cores hardcoded e `scroll` fixo (Shipments, Coletas, Rastreamento, Faturas, Extrato). Criar wrapper `DataTable` em `components/ui` com: headerBg/token, radius 12, `scroll={{ x: 'max-content' }}`, toolbar de filtros acoplada, e variações de densidade. Substituir `TrackingStatusTag`/`PickupStatusTag` cores hardcoded por tokens semânticos.
- **Modais/Diálogos**: diferentes padrões (CheckoutModal, CheckoutCartModal, LabelPrintModal, StatementPDFModal, Modal genérico em Faturas). Documentar default: header denso, radius 12, footer alinhado à direita, estados de loading e largura `maxWidth` por tipo (p.ex. 520px financeiro, 720px checkout). Incentivar uso do `App`/`Modal` tokens ao invés de estilos inline.
- **Toasts/Alerts/Empty**: `ELEmpty` existe, mas páginas usam `Alert`/`message` com cores padrão. Padronizar empty states com `ELEmpty` (cotação bloqueada, carteira sem cartões, coletas sem dados) e usar `App.useApp()` para mensagens com tipos semânticos (`success/warning/error/info`).
- **Componentes duplicados/legacy**:
  - `shipments-table.tsx` em `components/ui` não é usado nas páginas principais; avaliar substituição da tabela custom de `shipments`/`rastreamento` por ele ou removê-lo.
  - `PageHeader` vs `PageShell` (a maioria já usa PageShell); migrar páginas sem wrapper (devolucoes, conta/perfil, rastreio público) para PageShell ou variante pública com cabeçalho claro.
  - CSS modules com cores avulsas (`app/(envio)/cotacoes/cotacoes.module.css`, `page.module.css` de Minha Conta) devem migrar para tokens.

## Padrões de layout e grids
- **Container padrão**: largura fluida com `max-width: 1280px` opcional para páginas de formulário único (auth, suporte/novo, rastreio público). Padding horizontal 24px desktop, 16px mobile; controlar via `PageShell`.
- **Estrutura de página**: cabeçalho fixo azul de `PageShell` (título + ações), seguido de seções em `ELCard`/`Card` com `gap=md`. Para listas: bloco de filtros (stack em mobile) + tabela; para dashboards: grid 12 col (Row/Col com `gutter={[12,12]}`) e cards com alturas equilibradas.
- **Listas com filtros**: alinhar filtros em `Space`/`Flex` que quebra em duas linhas mobile. Exemplos a alinhar: `shipments/ShipmentsClient.tsx`, `coletas/ColetasClient.tsx`, `rastreamento/RastreamentoClient.tsx`, `carteira/extrato/ExtratoClient.tsx`.
- **Detalhes**: usar `Descriptions` ou grid 2 col com `gap=md` para páginas de detalhe (shipments/[id], rastreamento/[id]). Evitar `Card` aninhado sem padding consistente.
- **Wizard/form passo a passo**: `PickupWizard` e `cotacoes/finalizar` devem compartilhar padrão de steps fixo (topo), conteúdo com scroll e footer de ações sticky. Documentar em `components/quote` e `components/pickups`.
- **Sidebar/Header**: Sidebar dark (#0A2955) destoa do tema claro; alinhar com tokens (`colorPrimary`) ou criar modo “brand” consistente. Ajustar `DashboardShell` margin/padding para evitar overflow em mobile (Content height fixa hoje `calc(100vh - 64px)`).

## Plano de responsividade (desktop e mobile)
- **Prioridade alta**:
  - Tabelas em `/shipments`, `/coletas`, `/rastreamento`, `/carteira/faturas`, `/carteira/extrato`, `/etiquetas`: hoje dependem de `scroll` horizontal fixo; criar versões empilhadas em mobile (cards list) ou usar `responsive` do AntD com colunas ocultáveis; garantir ações acessíveis.
  - Filtros em linha (Shipments, Coletas, Rastreamento, Extrato) devem quebrar para coluna com `gap=12` e largura 100%.
  - `Sidebar` fixa causa overflow em alturas menores; garantir que `Content` não force `height: 100vh` em mobile (usar `min-height` e remover `overflow: hidden`).
- **Prioridade média**:
  - Dashboards (`app/(envio)/(overview)/OverviewClient.tsx`): ajustar `Row/Col` para 12/12/24 em breakpoints, garantir cards com alturas mínimas e padding reduzido em xs.
  - `Support` (FAQ + lista) e `PageShell` sticky header: validar espaçamentos para telas <360px; permitir desativar sticky em mobile.
  - `PublicTrackingClient`: cards com padding 12/16 e tags/botões que não quebrem texto; timeline responsiva.
- **Prioridade baixa**:
  - Placeholders (`/devolucoes`, `/conta/perfil`) — alinhar com PageShell e grid responsivo quando implementados.

## Oportunidades de modernização de componentes
- **Remover bifurcação de tema**: eliminar `NEW_THEME_ENABLED` e sempre usar wrappers EL + tokens. Atualizar auth pages e componentes que ainda dependem do flag.
- **Status e tags**: substituir cores hardcoded (`STATUS_COLORS` em múltiplos arquivos) por mapa central de tokens (`lib/ui/status-tokens.ts` sugerido), reutilizado por `TrackingStatusTag`, `PickupStatusTag`, tabelas de suporte/shipments.
- **Botões de ação**: trocar botões custom inline (ex.: divergência em `shipments`, copiar código em rastreio público) por `ELButton` com ícone e tamanho `small`, preservando acessibilidade (`aria-label`).
- **Modais/Skeletons**: criar presets (`ModalConfirm`, `DrawerDetails`, `SkeletonSection`) para substituir estilos repetidos de loading (spinners inline em layouts, `Suspense` fallback com estilos inline em `layout.tsx` e `LayoutWrapper`).
- **Menu e navegação**: alinhar Sidebar ao tema (claro ou brand), usar `theme.useToken` para cores de hover/seleção, remover CSS global duplicado e icon sizes hardcoded.
- **Feedback visual**: padronizar `Alert` (ex.: alerta de demo em Faturas, info de carteira sem cartões) com ícones, borda arredondada e variações tonais; aplicar `ELEmpty` em estados vazios de tabelas.

## Backlog sugerido
- **Padronizar wrappers de formulário e botões**
  - Descrição: remover `NEW_THEME_ENABLED`, migrar `Button/Input/Select/Form.Item` usados diretamente para `ELButton/ELInput/ELSelect/ELFormItem` nas páginas de Auth, Shipments, Coletas, Rastreamento, Carteira (filtros), Faturas, Public Tracking.
  - Arquivos/páginas: app/(auth)/auth/*, app/(envio)/shipments/*.tsx, app/(envio)/coletas/*.tsx, app/(envio)/rastreamento/*.tsx, app/(envio)/carteira/**/*.tsx, app/rastreio/[code]/PublicTrackingClient.tsx.
  - Benefício: consistência visual, acessibilidade e menor manutenção de estilos.
  - Prioridade: Alta | Esforço: Médio.
- **Criar wrapper de tabela responsiva (`DataTable`)**
  - Descrição: encapsular padrões de header, radius, empty state, responsividade e barras de ferramentas; substituir tabelas de Shipments, Coletas, Rastreamento, Faturas, Extrato, Labels.
  - Arquivos/páginas: components/ui (novo), app/(envio)/shipments/*.tsx, coletas/page.tsx, rastreamento/page.tsx, carteira/faturas, carteira/extrato, etiquetas/page.tsx.
  - Benefício: melhor UX mobile e manutenção única para colunas/tokens.
  - Prioridade: Alta | Esforço: Médio-Alto.
- **Revisão de layout e gutters**
  - Descrição: definir padrão de padding/gap por breakpoint no `PageShell` e grids; aplicar em Overview, Carteira, Suporte, Minha Conta; remover estilos inline de layout (ex.: wrappers com margin manual).
  - Arquivos/páginas: app/(envio)/(overview)/OverviewClient.tsx, carteira/page.tsx, suporte/*.tsx, minha-conta/MinhaContaClient.tsx, components/layout/dashboard-shell.tsx.
  - Benefício: ritmo visual consistente e redução de debt em CSS inline.
  - Prioridade: Média | Esforço: Médio.
- **Unificar tema e status tokens**
  - Descrição: consolidar mapa de cores de status (shipments, coletas, rastreamento, suporte) em arquivo compartilhado; atualizar componentes de Tag/Badge; alinhar Sidebar e loaders aos tokens (`colorPrimary`, `boxShadow`).
  - Arquivos/páginas: components/ui/TrackingStatusTag.tsx, PickupStatusTag.tsx, ShipmentsStatusBoard, app/(envio)/coletas/ColetasClient.tsx, app/(envio)/shipments/ShipmentsClient.tsx, components/layout/Sidebar.tsx.
  - Benefício: coerência semântica, modo fácil de alterar branding.
  - Prioridade: Média | Esforço: Médio.
- **Padrão de modais e drawers**
  - Descrição: criar presets (`ModalConfirm`, `SideDrawerDetail`) com títulos, espaçamentos e largura padronizados; aplicar em checkout (Cart/Quote), faturas, labels, suporte, divergências de envios.
  - Arquivos/páginas: components/payments/*Modal.tsx, components/labels/*Modal.tsx, app/(envio)/shipments/ShipmentsClient.tsx (modal de divergência), carteira/faturas/FaturasClient.tsx, suporte/TicketDetailsDrawer.tsx.
  - Benefício: UX moderna, acessibilidade consistente, redução de código duplicado.
  - Prioridade: Média | Esforço: Médio.
- **Responsividade de tabelas e filtros**
  - Descrição: implementar versões mobile (cards/accordion) e stacking de filtros com `Flex`/`Space` adaptativo; garantir `scroll={{ x: 'max-content' }}` e largura mínima para colunas-chave.
  - Arquivos/páginas: shipments, coletas, rastreamento, carteira/extrato, carteira/faturas, etiquetas.
  - Benefício: uso confortável em telas pequenas, sem overflow horizontal.
  - Prioridade: Alta | Esforço: Médio.
- **Modernizar páginas públicas e placeholders**
  - Descrição: aplicar `PageShell` ou variante pública a `/rastreio/[code]`, `/devolucoes`, `/conta/perfil`; alinhar cores a tokens e remover estilos inline antiquados.
  - Arquivos/páginas: app/rastreio/[code]/PublicTrackingClient.tsx, app/(envio)/devolucoes/page.tsx, app/(envio)/conta/perfil/page.tsx.
  - Benefício: experiência coesa para usuários externos e telas em desenvolvimento.
  - Prioridade: Baixa | Esforço: Baixo-Médio.
