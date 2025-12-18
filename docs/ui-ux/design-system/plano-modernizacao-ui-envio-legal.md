# Plano de padronização e modernização da UI do cliente (Envio Legal) — v3

Revisão final após execução do plano: DataTable, ELModal/ELDrawer, ELAlert/ELStatusTag, ELGrid e PageShell CSS foram adotados nas principais telas. Wrappers EL estão consolidados. Restam apenas ajustes finos de layout/UX e limpeza de legados pontuais.

## Visão geral da interface atual
- **Arquitetura**: Next.js (App Router) com grupo `app/(envio)` protegido por `DashboardShell`/`Sidebar`. Tema Ant Design aplicado via `ConfigProvider`; tokens expostos em `app/globals.css` (cores, espaçamentos, tipografia, status).
- **Páginas principais** (todas com `PageShell`):
  - **Dashboard** `/` (overview): cards de status/resumo/atalhos; ainda usa Row/Col com gutters variados.
  - **Cotação** `/cotacoes` e **finalização** `/cotacoes/finalizar`: forms com wrappers EL; modais e wizards usam ELModal em etapas de pagamento e comprovantes.
  - **Carrinho** `/carrinho`: ações com ELButton; modais de checkout migrados para ELModal.
  - **Carteira** `/carteira`, **Extrato** `/carteira/extrato`, **Faturas** `/carteira/faturas`: filtros e alerts em EL; tabelas migradas para DataTable (Extrato e Faturas); StatementPDFModal com ELModal.
  - **Coletas**, **Shipments**, **Rastreamento**: filtros em wrappers EL; tabelas migradas para DataTable (card-mode mobile); ações de linha com ELButton icon-only; status via ELStatusTag.
  - **Etiquetas** `/etiquetas`: DataTable + modais com ELModal (LabelPrintModal, ShipmentLabelModal).
  - **Suporte** `/suporte` e `/suporte/[id]/novo`: ELButton/ELStatusTag; TicketDetailsDrawer em ELDrawer; Cards ainda com padding variado.
  - **Minha Conta** `/minha-conta`: usa ELGrid para coluna dupla; formulários em Card.
  - **Rastreio público** `/rastreio/[code]`: ELButton/ELAlert/ELStatusTag; layout centralizado ainda com estilos inline simples.
  - **Placeholders** `/devolucoes`, `/conta/perfil`: permanecem mínimos.
- **Componentes transversais**: `PageShell` em CSS module (gaps tokenizados), `ELGrid` para grids responsivos, `DataTable` para listas, `ELModal/ELDrawer`, `ELAlert`, `ELStatusTag`, `ELTableWrapper` (ainda usado em poucos pontos de transição).

## Stack de UI/CSS e tema atual
- **Libs**: Ant Design 6 + CSS Modules. Sem libs de utilitários de CSS adicionais.
- **Tema**: tokens em `lib/ui/theme.ts` e CSS vars em `app/globals.css` (cores primária/secundária, status, neutros, sombras, radius, tipografia, espaçamentos). `lib/features/new-theme.ts` existe apenas para compatibilidade, mas não é mais usado no código.
- **Estilos globais**: `globals.css` fornece vars (incluindo sidebar/status); `Sidebar.module.css` usa tokens brand dark; `PageShell.module.css` define header sticky e gaps; `ELGrid` e `DataTable` trazem responsividade embutida.
- **Layout base**: `DashboardShell` ainda controla altura com `100vh`/`calc(100vh - 64px)`; fallback de loading em `app/(envio)/layout.tsx` permanece como spinner inline.

## Diretrizes de tema (cores, tipografia, espaçamentos)
- **Cores**: paleta semântica já centralizada (`primary #003873`, `secondary #E4660C`, `success #1E8E5A`, `warning #E4660C`, `danger #D64545`, `info #2B6CB0`, neutros bg/surface/text/border). Hardcodes restantes: azul do spinner (`#1890ff`) e variações em banners/cards inline; recomendação de trocas pontuais para tokens.
- **Tipografia**: escala via vars (`base 16`, `h3 20`, `h2 24`, `h1 28-32`, `caption 13`, `micro 12`) aplicada em PageShell/EL components; revisar apenas textos inline em páginas públicas/overview.
- **Espaçamentos**: vars `--el-spacing-*`; PageShell já usa 24/16; DataTable tem paddings responsivos; ELGrid controla gaps.
- **Radius/Sombras**: radius base 12/8 e sombras soft/subtle em uso via CSS vars; remover eventuais box-shadows inline residuais ao tocar nas telas restantes.

## Padronização de componentes (estado atual)
- **Botões**: `ELButton` (primary/default/link/danger/ghost) em filtros e ações; ações de linha agora usam icon-only. Poucos botões AntD podem restar em componentes antigos.
- **Inputs/Select/Form**: `ELInput/ELSelect/ELFormItem` consolidados em listas e formulários principais; QuickCalculator e eventuais forms legados já migrados.
- **Tabelas**: DataTable adotado em Shipments, Coletas, Rastreamento, Etiquetas, Extrato/Faturas e StatementTable; ELTableWrapper fica apenas como suporte a transição.
- **Modais/Drawers**: ELModal em pagamentos, etiquetas, faturas, divergências; ELDrawer em TicketDetails. Alguns fallbacks de loading ainda usam spinner inline.
- **Status/Tags**: ELStatusTag e TicketStatusTag amplamente aplicados; status centralizados via variantes.
- **Alerts/Empty**: ELAlert usado em Carteira/Faturas/Rastreio público; ELEmpty presente no DataTable; poucos `Alert` AntD podem persistir em páginas públicas ou banners antigos.
- **Grids/Layout**: ELGrid em Carteira/Minha Conta; Overview/Suporte/Etiquetas ainda usam Row/Col/padding manual.

## Padrões de layout e responsividade
- **Listas**: DataTable garante card-mode mobile e toolbar de filtros; overflow horizontal resolvido.
- **Containers**: PageShell padronizado; Sidebar mantém tema brand dark e ocupa 100vh; Content ainda com `overflow: hidden` e cálculo de altura em mobile.
- **Páginas com ajuste pendente**: Overview (equalizar alturas/gaps), Suporte/Etiquetas (padding/gutters), rastreio público (container e tipografia), placeholders (devoluções/perfil) para se alinhar ao padrão quando implementados.
- **Loaders**: spinner inline em `app/(envio)/layout.tsx` permanece único ponto não padronizado; restante usa ELSkeleton/estados do DataTable.

## Oportunidades finais de modernização
- Substituir o fallback de loading inline do layout por preset (ELSkeleton/ELAlert ou loader tokenizado).
- Revisar DashboardShell para remover `height/overflow` rígidos em mobile e alinhar padding ao PageShell.
- Harmonizar Overview/Suporte/Etiquetas/rastreio público com ELGrid e tokens de padding/tipografia.
- Decidir tema da Sidebar (manter brand dark ou alinhar ao light) e ajustar contraste.
- Atualizar placeholders `/devolucoes` e `/conta/perfil` para containers padrão quando evoluírem.

## Backlog recomendado (pós-conclusão)
- **Loaders e layout base**  
  - Itens: trocar spinner inline do layout por preset; ajustar `DashboardShell` para evitar overflow em mobile.  
  - Benefício: UX consistente e melhor responsividade.  
  - Prioridade: Alta | Esforço: Baixo-Médio.
- **Grids/padding em Overview, Suporte, Etiquetas, rastreio público**  
  - Itens: aplicar ELGrid/gaps tokenizados e remover padding inline.  
  - Benefício: ritmo visual uniforme e melhor mobile.  
  - Prioridade: Média | Esforço: Médio.
- **Tema da Sidebar**  
  - Itens: confirmar brand dark ou migrar para light; ajustar vars/contraste.  
  - Benefício: alinhamento de branding e acessibilidade.  
  - Prioridade: Baixa | Esforço: Baixo.
- **Placeholders e documentação**  
  - Itens: alinhar `/devolucoes` e `/conta/perfil` a PageShell quando tiverem conteúdo; limpar referências textuais antigas ao `NEW_THEME_ENABLED`.  
  - Benefício: elimina ruídos e deixa rotas prontas para evolução.  
  - Prioridade: Baixa | Esforço: Baixo.
