## Mapa de componentes
- Componentes base em `components/ui`: `ELButton`, `ELCard`, `ELModal`, `ELDrawer`, `DataTable`, `ELGrid`, `ELInput/ELSelect`, `ELAlert`, `ELStatusTag`, `ELTableWrapper`.
- Estrutura/layout em `components/layout`: `DashboardShell`, `Sidebar`, `MobileDrawer`, `UserPanel`.
- Wrappers de página em `components/shared`: `PageShell`, `LayoutLoader`.
- Telas reusam, mas há variações diretas de AntD em: `components/dashboard/*`, `components/quote/QuoteResultsSection.tsx`, `components/cart/CartTable.tsx`, `components/account/PersonalForm.tsx`, tabelas admin (`components/admin/finance/*.tsx`, `components/admin/users/UsersTable.tsx`), suporte (`components/support/TicketDetailsDrawer.tsx`).
- Modais/drawers: ✅ Migrados para `ELModal/ELDrawer` (Fase 3 concluída). Drawers de navegação mobile mantêm Drawer antd com width: 280px.
- Layouts distintos: `DashboardShell` usa `el-container`; admin (`app/(admin)/admin/layout.tsx`) e collector (`app/(collector)/collector/CollectorLayoutClient.tsx`) usam `Layout` puro.

## Inconsistências observadas
- Tipografia: cards/dashboard usam `Typography` default (13–15px) enquanto `ELCard` aplica tokens e títulos 22–28px; tabelas com fonts 12–13px (`ELTableWrapper`) coexistem com tabelas AntD default (14px) em `QuoteResultsSection.tsx` e `CartTable.tsx`.
- Espaçamento: `ELCard` aplica `gap` e padding tokenizado; `Card` AntD em `ShipmentsStatusBoard.tsx`, `QuickCalculator.tsx`, `CartTable.tsx` usam padding inline (12–24px) e gutters diferentes.
- Radius/sombras/cores: `ELCard` radius 12px; outros cards/modais/headers admin usam radius default 6px e cores padrão AntD. Shadows variam entre none e `var(--el-shadow-subtle)`.
- Altura de inputs/botões: `ELButton` (44→32px responsivo) x `Button` AntD default (40px) em filtros `components/dashboard/SupportQuickView.tsx`, `components/cart/CartTable.tsx`, formulários (`components/pickup/forms/*.tsx`), gerando desalinhamento vertical.
- Headers de página/seção: `PageShell` sticky azul em remetente; admin/collector e páginas públicas usam headers próprios ou nenhum, com padding distinto e sem `el-container`.

## Sugestão de consolidação (fonte da verdade)
- **AppContainer**: novo wrapper em `components/ui/AppContainer` usado por `DashboardShell`, `app/(admin)/admin/layout.tsx`, `app/(collector)/collector/CollectorLayoutClient.tsx` e rotas públicas (`app/(public)/*`). Substituir paddings inline nesses layouts.
- **PageHeader**: padronizar cabeçalhos com título + ações (variação do `PageShell` header) e aplicar em `/cotacoes`, `/cotacoes/finalizar`, `/shipments/[id]`, `/carteira/*`, `/admin/*`.
- **SectionCard**: usar `ELCard` (ou variação `SectionCard` com header compacto) em dashboard, cartões de carteira, cards de suporte e admin para alinhar padding/radius/typografia.
- **DataTable**: adotar `components/ui/DataTable.tsx` (ou `ELTableWrapper`) como tabela padrão; migrar `components/quote/QuoteResultsSection.tsx`, tabelas de detalhes de envio (`app/(envio)/shipments/[id]/ShipmentDetailClient.tsx`), `components/cart/CartTable.tsx`, tabelas admin (`components/admin/finance/*.tsx`, `components/admin/users/UsersTable.tsx`) e collectors para usar preset com `scroll.x`, ellipsis e cards mobile.
- **FormRow**: criar helper para grids de formulário (1–2 colunas com `min-width` 280px) e aplicar em `components/quote/QuoteForm.tsx`, `components/account/PersonalForm.tsx`, `components/pickup/forms/*.tsx`, `components/payments/CheckoutModal.tsx`.
- **ActionBar**: barra de filtros responsiva (wrap + dropdown de ações) para substituir `tableStyles.filterBar` duplicado em `app/(envio)/shipments/ShipmentsClient.tsx`, `app/(envio)/coletas/ColetasClient.tsx`, `app/(envio)/carteira/extrato/ExtratoClient.tsx`, `components/labels/LabelsTable.tsx`, páginas admin.
- **AppModal**: centralizar em `ELModal/ELDrawer` com presets de altura/largura e aplicar nos modais de cotação (`QuoteResultsSection.tsx`), PDF de etiquetas (`EtiquetasClient.tsx`), suporte (`TicketDetailsDrawer.tsx`), admin confirm dialogs e modais de pagamento.
