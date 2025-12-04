# Plano de execução por fases – Modernização da UI (Envio Legal) — v3

Estado atual: DataTable, ELModal/Drawer, ELAlert/ELStatusTag, ELGrid e wrappers EL estão implantados nas principais páginas (Shipments, Coletas, Rastreamento, Etiquetas, Extrato/Faturas, Carteira, Suporte, Pagamentos). Restam apenas ajustes finos de layout/UX e limpeza de legados menores.

## Visão geral do plano de execução
- Escopo: interface do remetente (`app/(envio)`) e páginas públicas de rastreio; fora `/admin` e coletores.
- Fases curtas, focadas em acabamentos: base/layout, grids/páginas públicas, branding da sidebar e placeholders.

## Fase 1 – Polimento base (loaders e layout principal)
**Objetivo**: remover restos de legados (loader inline, alturas rígidas) e alinhar containers base para mobile.

**Escopo**: layout do grupo `(envio)`, DashboardShell/Sidebar, fallback de loading. Fora: grids de páginas específicas (fase 2).

### Tarefas
1) Substituir loader inline do layout por preset  
   - Descrição: trocar spinner inline de `app/(envio)/layout.tsx` por preset (ELSkeleton/ELAlert ou loader tokenizado).  
   - Arquivos/rotas: `app/(envio)/layout.tsx`, `app/(envio)/LayoutWrapper.tsx` (se houver loader interno).  
   - Dependências: nenhuma.  
   - Benefício: UX consistente e acessível.  
   - Prioridade: Alta | Esforço: Baixo | Branch: `feat/ui-fase1-loader`.
   - Riscos: mínimos; validar carregamento inicial do dashboard.

2) Ajustar DashboardShell para mobile (altura/overflow)  
   - Descrição: remover `height: 100vh`/`calc(100vh - 64px)` e `overflow: hidden` no Content; usar `min-height` + `overflow: auto` com padding tokenizado 24/16.  
   - Arquivos/rotas: `components/layout/dashboard-shell.tsx`.  
   - Dependências: nenhuma.  
   - Benefício: evita cortes de conteúdo em telas menores.  
   - Prioridade: Alta | Esforço: Médio | Branch: `feat/ui-fase1-dashboard-shell`.  
   - Riscos: comportamento de scroll; testar com sidebar colapsando.

3) Revisar PageShell para mobile sticky opcional  
   - Descrição: permitir desativar sticky em mobile (prop) e garantir margens/padding consistentes com tokens.  
   - Arquivos: `components/shared/PageShell.tsx`.  
   - Dependências: nenhuma.  
   - Benefício: melhor UX em telas pequenas quando header ocupa espaço.  
   - Prioridade: Média | Esforço: Baixo | Branch: `feat/ui-fase1-pageshell-mobile`.  
   - Riscos: checar regressão em headers atuais.

**Critérios de aceite da fase**
- Loader do layout `(envio)` usa preset padrão (sem spinner inline).
- DashboardShell não causa overflow/corte em mobile; scroll funciona com sidebar aberta/fechada.
- PageShell oferece opção de desabilitar sticky em mobile e mantém padding 24/16.

**Checklist de QA**
- Abrir dashboard em viewport <768px, navegar por Shipments/Coletas/Rastreamento.
- Ver fallback de loading inicial (sem spinner legado).
- Verificar sticky de PageShell em mobile (quando desativado).

## Fase 2 – Grids e páginas com padding manual
**Objetivo**: harmonizar gutters/containers usando ELGrid/PageShell e eliminar estilos inline remanescentes.

**Escopo**: Overview, Suporte, Etiquetas, Rastreamento público; ajustes menores de tipografia/padding em cards.

### Tarefas
1) Harmonizar Overview com ELGrid/gaps tokenizados  
   - Descrição: substituir Row/Col variáveis por ELGrid; equalizar alturas de cards principais; reduzir estilos inline.  
   - Arquivos/rotas: `app/(envio)/(overview)/OverviewClient.tsx`.  
   - Dependências: Fase 1 (PageShell).  
   - Benefício: ritmo visual consistente e melhor mobile.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase2-overview-grid`.  
   - Riscos: balancear alturas dos cards.

2) Ajustar Suporte e Etiquetas (padding/gutters)  
   - Descrição: usar ELGrid/gaps e remover padding manual em Cards borderless; alinhar filtros/listas às tokens.  
   - Arquivos/rotas: `app/(envio)/suporte/*.tsx`, `app/(envio)/etiquetas/EtiquetasClient.tsx`.  
   - Dependências: nenhuma.  
   - Benefício: consistência visual e melhor legibilidade.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase2-suporte-etiquetas`.  
   - Riscos: mínimos; validar drawers/modais continuam ok.

3) Normalizar rastreio público e placeholders  
   - Descrição: envolver `/rastreio/[code]` em container padrão (PageShell público ou layout simples tokenizado); alinhar `/devolucoes` e `/conta/perfil` a PageShell para futura evolução.  
   - Arquivos/rotas: `app/rastreio/[code]/PublicTrackingClient.tsx`, `app/(envio)/devolucoes/page.tsx`, `app/(envio)/conta/perfil/page.tsx`.  
   - Dependências: nenhuma.  
   - Benefício: experiência coesa fora do dashboard.  
   - Prioridade: Baixa | Esforço: Baixo-Médio | Branch: `feat/ui-fase2-public`.  
   - Riscos: mínimos.

**Critérios de aceite da fase**
- Overview, Suporte, Etiquetas usam ELGrid/gaps tokenizados; sem padding inline divergente.
- Rastreio público/placeholders com container/padding consistente.
- Tipografia segue escala de tokens (sem tamanhos inline novos).

**Checklist de QA**
- Testar Overview em sm/md/lg (cards equilibrados).
- Suporte/Etiquetas em mobile e desktop (filtros, drawers, modais).
- Rastreio público em mobile (timeline + ações).

## Fase 3 – Branding da Sidebar e limpeza residual
**Objetivo**: definir tema da sidebar e remover resíduos textuais/arquivos legados.

**Escopo**: Sidebar vars/contraste e limpeza de docs/flags antigos.

### Tarefas
1) Decidir tema da Sidebar (brand dark vs light)  
   - Descrição: confirmar com PO/Brand; ajustar vars `--sidebar-*` e cores de ícones/trigger para contraste AA.  
   - Arquivos: `components/layout/Sidebar.tsx`, `components/layout/Sidebar.module.css`, `app/globals.css`.  
   - Dependências: nenhuma.  
   - Benefício: consistência com branding e acessibilidade.  
   - Prioridade: Baixa | Esforço: Baixo | Branch: `feat/ui-fase3-sidebar-theme`.  
   - Riscos: aceitação de branding; validar ícones no modo escolhido.

2) Limpar resíduos de documentação/flags antigos  
   - Descrição: remover referências textuais ao `NEW_THEME_ENABLED` em docs legados (sem uso no código); manter `lib/features/new-theme.ts` apenas se necessário para compat.  
   - Arquivos: docs auxiliares (CLIENT_PAGES_STRUCTURE.md etc.).  
   - Dependências: nenhuma.  
   - Benefício: reduz ruído e confusão para novos devs.  
   - Prioridade: Baixa | Esforço: Baixo | Branch: `chore/ui-fase3-docs-cleanup`.  
   - Riscos: mínimos.

**Critérios de aceite da fase**
- Sidebar com tema escolhido e contrastes revisados.
- Docs sem menções a flags obsoletas; nenhum TODO de legados pendente.

**Checklist de QA**
- Visual da sidebar em sm/md/lg com colapso.
- Verificar contraste de itens/ícones/trigger no tema definido.

## Cronograma sugerido
1. Fase 1 (loaders/layout base) – 1 sprint curto.  
2. Fase 2 (grids/páginas públicas) – 1 sprint.  
3. Fase 3 (sidebar/cleanup) – 0.5 sprint, pode ser paralelo ao fim da fase 2.

## Riscos gerais e mitigação
- Ajustes de layout podem afetar scroll em mobile: validar em dispositivos reais/DevTools.  
- Alterar padding/gutters pode impactar altura de cards do dashboard: revisar visualmente.  
- Tema da sidebar exige alinhamento com stakeholders para evitar retrabalho.

## Observações finais
- Continuar usando apenas AntD + wrappers EL (sem novas dependências).  
- Registrar no README de UI onde aplicar PageShell público e presets de loader.  
- Manter checklist de QA nas PRs por fase, com foco em mobile e fluxos críticos (checkout, rastreio, suporte).  
