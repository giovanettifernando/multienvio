# Auditoria de UI/UX – Remetente (Envio Legal)

Escopo: apenas UI do remetente (grupo `app/(envio)` e página pública de rastreio), mantendo stack atual (Next App Router + Ant Design + componentes EL). Sem mudanças de regras de negócio.

## 1) Inventário de telas/rotas e padrões

| Rota/Tela | Layout atual | Componentes principais | Problemas de responsividade/consistência |
| --- | --- | --- | --- |
| `/` (Overview) | `DashboardShell` + `PageShell`; grids em `ELGrid` + cards | ShipmentsStatusBoard, ShipmentsSummaryCard, QuickCalculator, WalletCard/Recent, SupportQuickView, PickupSchedule | Sem max-width: cards/grids esticam em 1600–2560px; header sticky ocupa largura total (margem negativa), gerando faixas enormes. |
| `/cotacoes` | `PageShell`; mix de `Row/Col` e `ELGrid` | Formulários longos, cards de serviço | Gutters de `Row` fixos (16/24px) escalam mal em >1440px; largura 100% sem container; inputs sem clamp de tipografia. |
| `/cotacoes/finalizar` | `PageShell`; `Row/Col` | Forms de documentos, resumo, modais de checkout | Mesmo problema de gutters fixos e largura solta; colunas 2x ficam muito afastadas em ultrawide; modais sem limite adaptativo. |
| `/carrinho` | `PageShell`; `Row/Col` + `DataTable` | Lista de itens, resumo e pagamento | Grid fixo; resumo cola à direita em telas grandes; tabela ok em card-mode mobile. |
| `/shipments`, `/coletas`, `/etiquetas`, `/rastreamento` | `PageShell` + `DataTable` | Tabelas com filtros, ações | Tabela cobre toda a largura; falta container para limitar 1920+; filtros sem wrap controlado em md/lg. |
| `/shipments/[id]`, `/coletas/[id]` | `PageShell`; cartões e timelines | Detalhes, timelines, ações | Colunas 2x sem max-width; textos longos quebram sem `clamp`. |
| `/carteira` + `/extrato` + `/faturas` + `/metodos` | `PageShell`; `ELGrid`, `DataTable`, modais | Cards e tabelas | Layout estável; ainda sem container central; headers sticky ocupam largura total. |
| `/minha-conta` | `PageShell`; `ELGrid` (2 colunas) | Cards de perfil, endereços, cartões | Boa responsividade; ausência de max-width gera grandes vazios laterais. |
| `/suporte`, `/suporte/novo`, `/suporte/[id]` | `PageShell`; **Card do AntD direto** | FAQ, lista de tickets, drawer de detalhes | Uso de `Card` nativo com `styles` inline, padding fixo 24px; sem `ELCard`; largura total. |
| `/rastreio/[code]` (público) | Layout simples, sem `PageShell` | Card/alertas | Container fluido sem limites; tipografia menor; gaps inconsistentes. |
| Placeholders removidos | `/conta/perfil`, `/devolucoes` | — | Sem impacto, manter padrão quando reativar. |

Referências-chave: `components/layout/dashboard-shell.tsx`, `components/shared/PageShell.tsx`, `components/ui/ELGrid.tsx`, `components/ui/DataTable.tsx`, `app/(envio)/suporte/*.tsx`.

## 2) Diagnóstico de responsividade

Breakpoints recomendados (alinhar `DashboardShell`, `ELGrid`, `DataTable` e modais):
- `xs` ≤ 575px: padding 16px; colunas 1x; tabelas em card-mode; sidebar vira drawer.
- `sm` 576–767px: padding 16–20px; manter 1x coluna; modais full-width com `max-width: 94vw`.
- `md` 768–1023px: padding 20px; grids 2x quando possível; sidebar ainda drawer; tabelas com scroll-x limitado a container.
- `lg` 1024–1279px: padding 24px; grids 2–3 col; sidebar fixa; modais `max-width: 720px`.
- `xl` 1280–1599px: container central `max-width: 1240–1320px`; grids 3–4 col (auto-fill); tabelas limitadas a container.
- `2xl` 1600–1919px: container `max-width: 1400–1480px`; aumentar gap apenas até `24px`; evitar colunas vazias.
- `3xl` ≥ 1920px (inclui 2560): container `max-width: 1520–1600px`; tipografia com `clamp`; limitar largura de modais a 900–1080px e cards a 420–480px.

Regras por área:
- **Container**: adicionar wrapper central em `DashboardShell`/`PageShell` (`max-width` por breakpoint + margin auto). Reduzir bleed do header sticky de `PageShell` (hoje usa margem negativa).
- **Grid**: unificar breakpoints do `ELGrid` (hoje 1024/768) com os novos; migrar `Row/Col` restantes (`Carrinho`, `CotacoesFinalizar`) para `ELGrid`.
- **Tabelas**: `DataTable` já tem card-mode <768; alinhar scroll/hide columns por breakpoint (`showInCard`/`cardLabel`); definir `scroll.x` automático com `max-content` dentro do container.
- **Modais/Drawers**: padronizar largura (`clamp(320px, 90vw, 720px)` desktop; full em xs/sm); fullscreen opcional apenas em xs/sm.
- **Sidebar**: hoje troca em 768px mas o `Sider` usa breakpoint `lg` (992px). Unificar em 1024px ou 992px (ideal 1024 para alinhar `ELGrid`) e remover `margin-left` rígido em `DashboardShell`.

Anti-patterns atuais (exemplos):
- Containers 100% sem limite e header com margem negativa (`components/shared/PageShell.module.css`), produzindo faixas enormes em ultrawide.
- `DashboardShell` não aplica `max-width` e usa `marginLeft` fixo; `Content` ocupa 100dvh com `overflow: auto`, duplicando scroll em mobile.
- Breakpoints dispersos: 768px (DataTable, PageShell), 1024px (ELGrid), 992px (`Sider`), gerando comportamentos diferentes por componente.
- `Row/Col` com gutters fixos (16/24px) em `/cotacoes`, `/cotacoes/finalizar`, `/carrinho` que esticam demais em >1440px.
- Tipografia fixa sem `clamp` para headings (PageShell `20px` desktop / `18px` mobile) e cards herdando `16px`, causando texto gigante em 2560px.

## 3) Padronização visual (Design Tokens)

Tokens mínimos (reutilizar existentes em `app/globals.css` / `lib/ui/theme.ts`):
- **Spacing**: 4, 8, 12, 16, 24, 32 (já expostos). Usar mapa `space.xs…xxl` em todos os CSS modules; evitar valores inline (ex.: `styles={{ body: { padding: 24 }}}` em suporte).
- **Radius**: 8 (sm), 12 (base), 16 (lg) já definidos. Aplicar a cards/modais/tabelas; evitar radius default do AntD em usos diretos.
- **Tipografia**: escalar com `clamp`  
  - Body: `clamp(15px, 1vw + 14px, 16px)`  
  - H3 (PageShell): `clamp(18px, 0.7vw + 17px, 22px)`  
  - Captions: 12–13px fixos.  
  Harmonizar line-height `1.5` (body) / `1.25` (titles).
- **Layout maxWidth** (por breakpoint, para container PageShell/DashboardShell):  
  `xs/sm`: fluid; `md`: 960px; `lg`: 1160px; `xl`: 1280px; `2xl`: 1440px; `3xl`: 1560px.
- **Cores/Sombras**: manter vars atuais; substituir hardcodes (suporte, banners) por `--color-primary`, `--color-border`, `--el-shadow-*`.

Aplicação:
- Centralizar tokens via `ConfigProvider` (já feito) + CSS vars globais; criar util `layout.css` para containers e aplicar em `DashboardShell` e `PageShell`.
- Ajustar `PageShell.module.css` para usar `clamp` de font-size e remover margem negativa; header deve respeitar `max-width` do container.
- Atualizar componentes que ainda passam paddings inline (`Card` no suporte, layouts `Row/Col`) para usar spacing tokens.

## 4) Componentes a consolidar

| Área | Variações encontradas | Fonte da verdade proposta | Onde trocar |
| --- | --- | --- | --- |
| Cards | `Card` do AntD com `styles` inline (suporte) vs `ELCard` | `components/ui/ELCard` (padding/gap tokenizados, header consistente) | `app/(envio)/suporte/SuporteClient.tsx`, `.../suporte/novo/NovoSuporteClient.tsx`, `.../suporte/[id]/TicketDetailClient.tsx` |
| Grid/Layout | `Row/Col` com gutters fixos vs `ELGrid` | `components/ui/ELGrid` + util de span | `app/(envio)/cotacoes/finalizar/FinalizarClient.tsx`, `app/(envio)/carrinho/CarrinhoClient.tsx`, trechos de `/cotacoes` |
| Header de página | `PageShell` sticky com bleed vs container limitado | `components/shared/PageShell` ajustado para respeitar `max-width` e optar por sticky por breakpoint | Todas as páginas já usam PageShell; basta atualizar o componente |
| Buttons/Inputs | Predominantemente `ELButton/ELInput`; poucos AntD diretos | Manter `components/ui/*` | Monitorar novas implementações para não reintroduzir AntD bruto |
| Modais/Drawers | ELModal/ELDrawer já adotados; validar larguras | `components/ui/ELModal` / `ELDrawer` com clamp de largura | Revisar modais de checkout/etiquetas para aplicar novos `max-width` |
| Tabelas | `DataTable` vs `Table` nativo (não encontrado em envios) | `components/ui/DataTable` | Garantir uso em novas listas; remover qualquer resquício de `Table` se surgir |

## 5) Plano de execução por fases (sem quebrar tudo)

**Fase 1 – Correções rápidas de layout base (alta prioridade, baixo risco)**  
- Implementar container central e `max-width` no `DashboardShell` e `PageShell`; remover margem negativa do header e alinhar padding por breakpoint.  
- Unificar breakpoints (exportar de um único arquivo) e aplicar em `ELGrid`, `DataTable`, `PageShell`, `DashboardShell`.  
- Converter `Row/Col` críticos de `/cotacoes/finalizar` e `/carrinho` para `ELGrid` sem mudar lógica.  
- Ajustar tipografia base para `clamp` no CSS global.  
Riscos: pequenos deslocamentos de layout; mitigação com comparação visual em 1280/1600/1920.

**Fase 2 – Padronização de componentes e tokens (médio)**  
- Substituir `Card` AntD por `ELCard` nas rotas de suporte; aplicar spacing tokens.  
- Aplicar clamp de largura em `ELModal/ELDrawer`; atualizar modais de checkout/etiquetas.  
- Harmonizar filtros/headers de tabelas: usar `DataTable` props (`showInCard`, `cardLabel`, `compact`) e limitar largura de toolbars.  
- Revisar cores hardcoded em componentes de dashboard/rastreio público para usar vars.  
Riscos: regressão visual em modais; validar em xs/md/lg.

**Fase 3 – Refinamentos e estados (baixo, contínuo)**  
- Ajustar microinterações: hover/focus de botões/links no tema; loader padrão para layout (substituir spinner inline).  
- Estados vazios consistentes (`ELEmpty`/`ELAlert`) em listas e cards; mensagens alinhadas.  
- Revisar placeholders futuros (`/devolucoes`, `/conta/perfil`) para já nascerem com PageShell/ELGrid e tokens.  
Riscos: mínimos; dependerá de priorização de UX.

Checklist rápido por entrega:
- F1: container + breakpoints unificados + grids críticos migrados.  
- F2: suporte em ELCard + modais clamp + toolbars de tabela revisadas.  
- F3: loaders/empty states + novos conteúdos seguindo o padrão.

