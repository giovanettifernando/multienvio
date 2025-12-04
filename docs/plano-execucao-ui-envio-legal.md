# Plano de execução por fases – Modernização da UI (Envio Legal) — v2

Estado atual pós-execução inicial: tokens/vars aplicados em `globals.css`, wrappers EL adotados em filtros/forms principais, novos componentes base (DataTable, ELModal/Drawer, ELAlert, ELStatusTag, ELGrid, PageShell CSS) criados, mas DataTable/modais/ações inline ainda não foram migrados e há legados (`NEW_THEME_ENABLED` nos imports, loaders inline, Table padrão nas listas).

## Visão geral do plano de execução
- Escopo: interface do remetente (`app/(envio)` + páginas públicas de rastreio e auth). Fora de escopo: `/admin`, `/coletores`/`/collectors`.
- Fases sequenciais com entregas pequenas e percebíveis; mantêm a stack atual (AntD + wrappers EL).

## Fase 1 – Consolidação de fundações e limpeza de legados
**Objetivo**: remover bifurcações remanescentes, alinhar tokens/vars e garantir que wrappers e layouts base estejam consistentes antes de tocar listas e modais.

**Escopo**: limpeza de `NEW_THEME_ENABLED`, tokens e loaders; revisão de wrappers faltantes; ajustes rápidos no `DashboardShell/PageShell`. Fora: tabelas e modais (fases seguintes).

### Tarefas
1) Remover flag legacy e imports de `NEW_THEME_ENABLED`  
   - Descrição: excluir uso do flag nas páginas de auth e qualquer condicional restante; documentar que o tema é único.  
   - Arquivos/rotas: `lib/features/new-theme.ts`, `app/(auth)/auth/*`, eventuais imports em componentes.  
   - Dependências: nenhuma.  
   - Benefício: elimina bifurcação de código e risco de regressão de tema.  
   - Prioridade: Alta | Esforço: Baixo | Branch: `feat/ui-fase1-remover-flag`.  
   - Riscos: mínimos; testar fluxos de auth.

2) Revisar wrappers EL faltantes em formulários/filtros pontuais  
   - Descrição: trocar `Input/Select/Button` puros em `QuickCalculator`, modais de pagamento/checkout, filtros de Etiquetas e ações em `CheckoutModal/CheckoutCartModal`.  
   - Arquivos/rotas: `components/dashboard/QuickCalculator.tsx`, `components/payments/*`, `app/(envio)/etiquetas/EtiquetasClient.tsx`, `app/(envio)/cotacoes/finalizar/*`.  
   - Dependências: nenhuma.  
   - Benefício: consistência visual e estados de foco/erro padronizados.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase1-wrappers-restantes`.  
   - Riscos: mudanças em fluxos críticos de checkout; testar.

3) Ajustar PageShell/Sidebar/DashboardShell para overflow e padding padrão  
   - Descrição: garantir padding 24/16, remover `height: 100vh`/`overflow: hidden` que afeta mobile, revisar sticky em mobile.  
   - Arquivos: `components/shared/PageShell.tsx`, `components/layout/dashboard-shell.tsx`, `components/layout/Sidebar.tsx`.  
   - Dependências: nenhuma.  
   - Benefício: navegação sem cortes em mobile e ritmo visual consistente.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase1-layout-base`.  
   - Riscos: comportamento de colapso da sidebar; validar breakpoints.

4) Substituir loaders inline por presets (`ELSkeleton`/`ELAlert`)  
   - Descrição: retirar spinners inline em `app/(envio)/layout.tsx`, `LayoutWrapper`, modais; usar skeleton/alerta padronizado.  
   - Arquivos: `app/(envio)/layout.tsx`, `app/(envio)/LayoutWrapper.tsx`, modais que mostram “Carregando...”.  
   - Dependências: nenhuma.  
   - Benefício: UX consistente e acessível.  
   - Prioridade: Baixa | Esforço: Baixo | Branch: `feat/ui-fase1-loaders`.  
   - Riscos: mínimos.

**Critérios de aceite da fase**
- Nenhum import/uso de `NEW_THEME_ENABLED`.
- Filtros/forms citados usam `ELButton/ELInput/ELSelect`.
- PageShell/Sidebar não causam overflow em mobile; padding/gaps seguem tokens.
- Loaders inline substituídos por `ELSkeleton`/`ELAlert` onde cabível.

**Checklist de QA**
- Fluxos de auth e checkout (cotação finalizada, pagamento do carrinho).
- Navegação mobile com sidebar colapsando corretamente.
- Verificar telas com novo loader (overview, layout fallback).

## Fase 2 – Listas responsivas com DataTable
**Objetivo**: substituir `Table` + `ELTableWrapper` por `DataTable` com card-mode mobile e toolbar de filtros integrada.

**Escopo**: todas as listas principais do remetente. Fora: modais/drawers (fase 3).

### Tarefas
1) Shipments e Coletas no `DataTable`  
   - Descrição: mapear colunas para `DataTableColumn`, definir `cardLabel` e `showInCard`, mover filtros para toolbar do DataTable; substituir `Tag` por `ELStatusTag`; substituir ações inline por `ELButton` icon-only.  
   - Arquivos/rotas: `app/(envio)/shipments/ShipmentsClient.tsx`, `app/(envio)/coletas/ColetasClient.tsx`.  
   - Dependências: Fase 1 wrappers.  
   - Benefício: uso confortável em mobile e códigos de status sem hardcodes.  
   - Prioridade: Alta | Esforço: Médio-Alto | Branch: `feat/ui-fase2-datatable-shipments-coletas`.  
   - Riscos: ações críticas (cancelar, divergência); validar.

2) Rastreamento e Etiquetas no `DataTable`  
   - Descrição: aplicar DataTable em `/rastreamento` e `/etiquetas`, garantindo colunas mínimas e ações (abrir detalhes/imprimir) em card-mode.  
   - Arquivos/rotas: `app/(envio)/rastreamento/RastreamentoClient.tsx`, `app/(envio)/etiquetas/EtiquetasClient.tsx`, `components/labels/LabelsTable.tsx`.  
   - Dependências: Tarefa 1.  
   - Benefício: leitura em mobile e empty/loading padronizados.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase2-datatable-rastreio-etiquetas`.  
   - Riscos: ações de impressão devem permanecer acessíveis.

3) Financeiro (Extrato/Faturas) no `DataTable`  
   - Descrição: mover tabelas de extrato e faturas para DataTable, com filtros stackáveis e paginação integrada; usar `ELAlert` para banners.  
   - Arquivos/rotas: `app/(envio)/carteira/extrato`, `app/(envio)/carteira/faturas`.  
   - Dependências: Tarefa 1.  
   - Benefício: UX mobile e toolbar unificada.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase2-datatable-financeiro`.  
   - Riscos: formatos de moeda/data; validar paginação.

**Critérios de aceite da fase**
- Shipments, Coletas, Rastreamento, Etiquetas, Extrato e Faturas usam `DataTable` com card-mode mobile (sem overflow horizontal bruto).
- Ações principais acessíveis em mobile; empty/loading states padronizados.

**Checklist de QA**
- Breakpoints sm/md/lg para todas as listas.
- Ações: imprimir etiqueta, cancelar envio, abrir detalhe, filtros/paginação.
- Empty e loading exibidos corretamente.

## Fase 3 – Modais, drawers e feedbacks
**Objetivo**: padronizar modais/drawers e feedbacks (alerts/empty) com os novos componentes EL.

**Escopo**: modais/drawers de checkout, pagamentos, etiquetas, suporte; alerts/empty nos fluxos principais. Fora: layouts/base (já tratados).

### Tarefas
1) Adotar `ELModal`/`ELDrawer` nos fluxos críticos  
   - Descrição: substituir modais existentes por `ELModal` (presets de tamanho/radius) e `ELDrawer` (detalhes de ticket); ajustar footers com `ELButton`.  
   - Arquivos/rotas: `components/payments/CheckoutModal.tsx`, `components/payments/CheckoutCartModal.tsx`, `components/labels/*Modal.tsx`, `components/support/TicketDetailsDrawer.tsx`, `components/pickups/PickupWizard.tsx` (steps/footers).  
   - Dependências: Fase 1 (wrappers).  
   - Benefício: UX previsível, acessibilidade e tokens aplicados.  
   - Prioridade: Alta | Esforço: Médio | Branch: `feat/ui-fase3-modais`.

2) Padronizar alerts/empty states  
   - Descrição: trocar `Alert`/`message` avulsos por `ELAlert` tonais e `ELEmpty` em tabelas/wizards; banners informativos em Carteira/Faturas/Rastreio público usam `ELAlert`.  
   - Arquivos/rotas: `app/(envio)/shipments/ShipmentsClient.tsx`, `app/(envio)/coletas/ColetasClient.tsx`, `app/(envio)/etiquetas/EtiquetasClient.tsx`, `app/rastreio/[code]/PublicTrackingClient.tsx`, carteiras.  
   - Dependências: nenhuma.  
   - Benefício: feedback consistente e acessível.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase3-feedbacks`.  
   - Riscos: não perder mensagens críticas.

3) Botões de ação icon-only e status unificados  
   - Descrição: substituir botões inline com cores hardcoded (Shipments, Etiquetas, Rastreamento público) por `ELButton` icon-only e `ELStatusTag`; remover `Tag` com cores custom.  
   - Arquivos/rotas: `app/(envio)/shipments/ShipmentsClient.tsx`, `app/(envio)/etiquetas/EtiquetasClient.tsx`, `app/rastreio/[code]/PublicTrackingClient.tsx`.  
   - Dependências: Tarefa 1.  
   - Benefício: consistência de ações e status, melhor acessibilidade.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase3-actions-status`.  
   - Riscos: garantir tooltips/aria-labels.

**Critérios de aceite da fase**
- Modais/drawers citados usam `ELModal/ELDrawer` com radius/padding padrão.
- Alerts/empties padronizados em listas e fluxos de erro.
- Ações de linha usam `ELButton` icon-only; status via `ELStatusTag`.

**Checklist de QA**
- Fluxo de checkout (cotação e carrinho), geração/impressão de etiquetas.
- Suporte: abrir/fechar drawer, mudar status de ticket.
- Modais em mobile (scroll e largura).

## Fase 4 – Layouts, grids e páginas públicas
**Objetivo**: alinhar containers, gutters e grids usando `ELGrid/PageShell`, e concluir páginas públicas/placeholders.

**Escopo**: Overview, Suporte, Etiquetas, Rastreamento público, placeholders de Devoluções/Perfil. Fora: tabelas (já migradas na fase 2).

### Tarefas
1) Aplicar `ELGrid` e gutters padrão em Overview e Suporte/Etiquetas  
   - Descrição: substituir Row/Col/padding inline por `ELGrid` e gaps tokenizados; equalizar alturas dos cards principais do dashboard.  
   - Arquivos/rotas: `app/(envio)/(overview)/OverviewClient.tsx`, `app/(envio)/suporte/*.tsx`, `app/(envio)/etiquetas/EtiquetasClient.tsx`.  
   - Dependências: Fase 2 (para tabelas de Etiquetas).  
   - Benefício: ritmo visual e responsividade consistente.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase4-layouts-grid`.  
   - Riscos: ajustes de altura dos cards do dashboard.

2) Normalizar páginas públicas/placeholders com PageShell pública  
   - Descrição: aplicar variante de `PageShell`/container público em `/rastreio/[code]`, `/devolucoes`, `/conta/perfil`; remover padding inline.  
   - Arquivos/rotas: `app/rastreio/[code]/PublicTrackingClient.tsx`, `app/(envio)/devolucoes/page.tsx`, `app/(envio)/conta/perfil/page.tsx`.  
   - Dependências: Fase 3 (alerts/feedbacks).  
   - Benefício: experiência coesa fora do dashboard.  
   - Prioridade: Baixa | Esforço: Baixo-Médio | Branch: `feat/ui-fase4-public`.  
   - Riscos: mínimos.

3) Revisar Sidebar theme (brand dark vs light)  
   - Descrição: decidir se mantém brand dark ou passa para light; ajustar vars (`--sidebar-*`) e contraste de ícones/trigger.  
   - Arquivos: `components/layout/Sidebar.tsx`, `Sidebar.module.css`, `app/globals.css`.  
   - Dependências: Fase 1 (tokens).  
   - Benefício: alinhamento ao tema geral e contraste.  
   - Prioridade: Baixa | Esforço: Baixo | Branch: `feat/ui-fase4-sidebar-theme`.  
   - Riscos: aceitação de branding; validar com PO.

**Critérios de aceite da fase**
- Overview, Suporte, Etiquetas usam `ELGrid`/gaps padronizados (sem paddings inline).
- Páginas públicas/placeholders com container consistente.
- Sidebar com tema definido e documentado (dark brand ou light).

**Checklist de QA**
- Responsividade dos grids no dashboard e suporte.
- Páginas públicas em mobile (rastreio público).
- Verificar contraste da sidebar no tema escolhido.

## Cronograma sugerido
1. Fase 1 (fundação/limpeza) – 1 sprint curto; destrava demais fases.  
2. Fase 2 (DataTable) – 1-2 sprints; prioridade alta para listas críticas.  
3. Fase 3 (modais/feedbacks) – 1 sprint após DataTable nas listas principais.  
4. Fase 4 (layouts/public) – 1 sprint final, pode rodar paralelo ao final da Fase 3.

## Riscos gerais e mitigação
- **Fluxos críticos (checkout/financeiro)**: manter branches pequenos, testes E2E básicos antes de merge.  
- **Quebra de responsividade ao migrar tabelas**: validar card-mode em dispositivos reais/DevTools.  
- **Ações inline perdidas**: garantir `aria-label`/tooltips ao trocar botões por icon-only.  
- **Tema da sidebar**: alinhar com PO/Brand antes de alterar.

## Observações finais
- Não adicionar dependências de UI; usar AntD + wrappers EL recém-criados.  
- Documentar mapa de status/cores junto ao `ELStatusTag` para reuso.  
- Manter checklist de QA por fase no PR e registrar migrações (lista de páginas migradas para DataTable/ELModal).  
