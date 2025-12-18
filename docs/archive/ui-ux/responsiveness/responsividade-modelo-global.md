> Arquivo arquivado: Modelo proposto antes da execução. | Fonte de verdade: `ui-ux/responsiveness/implementacao-responsividade.md`.

> **NOTA (2025-12-11):** Este documento descreve o modelo proposto. A implementação foi realizada nas Fases 1-3. Ver `ui-ux/responsiveness/implementacao-responsividade.md` para detalhes completos.

## AppContainer ✅ Implementado
- ✅ Criado `components/ui/AppContainer.tsx` usado em layouts com largura centralizada e paddings responsivos.
- Max-width por faixa: `<=768px: 100%`, `769–1023px: calc(100% - 32px)`, `1024-1279px: calc(100% - 48px)`, `1280–1439px: 1280px`, `1440–1919px: 1400px`, `>=1920px: 1600px` (parar de escalar).
- Paddings: `16px` mobile, `24px` tablet, `32px` desktop; sempre `margin: 0 auto`.
- ✅ globals.css atualizado com max-width 1600px para ultrawide.

## Tokens globais
- Espaçamento: escala curta e estável `4/8/12/16/24/32/48`. Usar nomes (`space.xs`...`space.3xl`) e aplicá-los a `gap`, `padding`, `margin`.
- Tipografia: base 15–16px com clamp (ex.: `clamp(14px, 1vw + 12px, 16px)`), títulos com clamp suave (`h1: clamp(22px, 2vw + 14px, 28px)`, `h2: clamp(18px, 1.5vw + 12px, 22px)`), line-height 1.4–1.6.
- Radius/sombra: `radius.sm=8px`, `radius.md=12px`, `radius.lg=16px`; sombras leves (`0 10px 24px rgba(0,56,115,0.08)` e `0 4px 12px rgba(0,0,0,0.05)`).
- Escala fluida para espaçamento e tipografia: expor helpers (`clampSpace(min,max,viewport)`) para uso em seções hero/dashboards; manter tabelas e formulários na escala fixa para previsibilidade.

## Regras por altura (<=800px / 1366×768) ✅ Implementado
- ✅ Modo compact automático via `@media (max-height: 800px)` em globals.css
- ✅ Tabelas com `scrollY: calc(100vh - Xpx)` em todas as listagens
- ✅ ELModal/ELDrawer com max-height e body scroll
- ✅ ActionBar criado para filtros responsivos com colapso

## Padrões por tipo de componente

### Tabelas ✅ Implementado
- ✅ DataTable com `scrollX`, `scrollY`, `ellipsis` por padrão, modo card mobile
- ✅ Todas as tabelas principais migradas

### Modais ✅ Implementado
- ✅ Todos usando `ELModal` com presets `sm/md/lg`
- ✅ max-height e body scroll automáticos

### Drawers ✅ Implementado
- ✅ Formulários usando `ELDrawer` com presets `sm/md/lg/xl`
- Drawers de navegação mobile mantêm Drawer antd (width: 280px específico)

### Formulários (parcial)
- [ ] FormRow helper para formulários responsivos (pendente)
- ✅ VolumesGrid responsivo implementado

### Botões/Ações ✅ Implementado
- ✅ ELButton usado em toda aplicação
- ✅ ActionBar para filtros com extraActions dropdown

### Headers ✅ Implementado
- ✅ PageShell com header responsivo
- ✅ Admin/Collector com sidebar responsiva (200px/240px)
