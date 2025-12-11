## Fase 1 — Global (container + tokens + ajustes base)
- Checklist:
  - Implementar `AppContainer` com max-width por faixa e aplicar em `DashboardShell`, admin layout, collector layout e páginas públicas.
  - Revisar tokens (espaçamento/tipografia/radius) em `app/globals.css` e alinhar `EL*` para usarem apenas esses tokens.
  - Criar variantes “compact” para `PageShell`/`SectionCard` (padding menor, header enxuto) e para `ELButton`/`DataTable` (font 12–13px, altura 36px) ativadas por altura <=800px.
  - Padronizar `DataTable` default com `scroll.x`, `ellipsis`, cards mobile e prop opcional `maxHeight`.
  - Expor `ActionBar` (filtros) e substituir `tableStyles.filterBar` duplicadas.
- Riscos de regressão: mudança de layout pode afetar snapshots de testes E2E e posicionamento de tooltips; sider colapsável pode alterar rotas abertas.
- Critérios de aceite: todas as páginas dentro do AppContainer; 1366×768 sem overflow horizontal global; modais herdando `max-height`; tabelas com `scroll.x` e células compactas em 1366×768.

## Fase 2 — Páginas críticas
- Alvos: `/cotacoes` (form + resultados), `/cotacoes/finalizar`, `/shipments` e `/shipments/[id]`, `/coletas`, `/carteira/extrato`, `/etiquetas`, `/admin/*` e `/collector/*`.
- Checklist:
  - Cotação: refatorar `QuoteForm` para `FormRow` 1 col no mobile; trocar `QuoteResultsSection` para `DataTable` com cards mobile e modais via `ELModal`.
  - Finalizar: ajustar `ELGrid finalizer` para 2 col em >=1280 e 1 col <1280; inserir `maxHeight` nos painéis e garantir botões visíveis em 1366×768.
  - Shipments/coletas/extrato: aplicar `ActionBar` compacta, limitar altura das tabelas (`maxHeight` ou `scroll.y`) e mover ações extras para dropdown.
  - Detalhe de envio: quebrar tabelas aninhadas em cards com `DataTable`/`ELTableWrapper`, `scroll.x` e ellipsis; revisar timeline para largura fluida.
  - Etiquetas: limitar altura do modal PDF e garantir expand row com `scroll.x` no desktop.
  - Admin/collector: introduzir colapso real da sidebar, AppContainer e tabelas com `scroll.x`; alinhar botões às variantes EL.
- Riscos de regressão: mudanças em flows de cotação e checkout afetarem cálculos; altura limitada de tabela pode esconder linhas se `scroll` não for calculado com filtros ativos.
- Critérios de aceite: em 1366×768 nenhum header/filtro/table corta conteúdo; mobile 360×640 sem scroll horizontal nas páginas-alvo; tabelas e modais com ellipsis/scroll visível.

## Fase 3 — Refino e consistência final ✅ CONCLUÍDA

- Checklist:
  - ✅ Migrar todos os Modals antd para ELModal (22+ componentes)
  - ✅ Migrar Modal.confirm() para App.useApp().modal.confirm() (4 componentes)
  - ✅ Adicionar scrollY em todas as tabelas restantes (13+ componentes)
  - ✅ Migrar Drawers de formulário para ELDrawer (4 componentes)
  - ✅ Verificar ELModal width → size (já estava correto)
  - [ ] Criar FormRow helper para formulários responsivos (pendente)
  - [ ] Adicionar testes visuais/E2E básicos (pendente)

- Riscos de regressão: ajustes de CSS globais podem afetar páginas legadas pouco usadas; mudanças de tipografia podem impactar quebra de texto em PDF/prints.
- Critérios de aceite: consistência visual entre remetente/admin/collector; 1366×768 validado sem overflow em todas as rotas principais; modais/drawers/tabelas mantendo comportamento fluido em 360×640 e 3440×1440.
- **Build final:** ✅ Passou com sucesso (201 páginas)
