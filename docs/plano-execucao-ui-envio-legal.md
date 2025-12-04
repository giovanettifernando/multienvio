# Plano de execução por fases – Modernização da UI (Envio Legal)

## Visão geral do plano de execução
- Escopo: somente interface do remetente em `app/(envio)` e páginas públicas relacionadas (ex.: `/rastreio/[code]`) e auth. Admin/coletores ficam fora.
- Estrutura em 4 fases sequenciais que entregam valor incremental e reduzem risco de big bang.
- Cada fase fecha um conjunto claro de páginas/rotas e componentes, com critérios de aceite e checklist de QA.

## Fase 1 – Fundamentos de tema e wrappers base
**Objetivo**: Consolidar tokens de tema e eliminar bifurcações (`NEW_THEME_ENABLED`), garantindo que botões, inputs e formulários usem wrappers EL com os tokens centralizados.

**Escopo**: ajustes em tema/tokens globais, wrappers EL e páginas de auth + formulários principais. Fora: tabelas, layouts de página, modais, responsividade avançada.

### Tarefas (numeradas)
1) Padronizar tokens e variáveis globais  
   - Descrição: alinhar `app/globals.css` às cores/tokens de `lib/ui/theme.ts`, remover duplicatas e hardcodes básicos (`#0A2955` da sidebar só depois na fase 3).  
   - Arquivos/rotas: `app/globals.css`, `lib/ui/theme.ts` (somente ajustes de var mapping).  
   - Dependências: nenhuma.  
   - Benefício: fonte única de verdade para cores e espaçamentos.  
   - Prioridade: Alta | Esforço: Baixo | Branch: `feat/ui-fase1-tokens`.  
   - Riscos: impacto global de CSS; validar em smoke geral.

2) Remover `NEW_THEME_ENABLED` e unificar wrappers EL  
   - Descrição: eliminar checks de feature flag em `ELButton`, `ELInput`, `ELSelect`, `ELFormItem`, auth pages; garantir uso direto do estilo novo.  
   - Arquivos/rotas: `components/ui/EL*.tsx`, `app/(auth)/auth/*`, `components/ui/FormCard`.  
   - Dependências: Tarefa 1.  
   - Benefício: evita bifurcação de estilos e reduz dívida.  
   - Prioridade: Alta | Esforço: Médio | Branch: `feat/ui-fase1-wrappers`.  
   - Riscos: login/signup são críticos; testar todos fluxos de auth.

3) Migrar uso direto de Button/Input/Select para wrappers EL em formulários e filtros simples  
   - Descrição: trocar componentes puros AntD por wrappers EL em filtros básicos e forms menores (Coletas, Shipments, Rastreamento, Carteira filtros, Public Tracking, Support).  
   - Arquivos/rotas: `app/(envio)/coletas/page.tsx`, `shipments/page.tsx`, `rastreamento/page.tsx`, `carteira/extrato`, `carteira/faturas`, `rastreio/[code]`, `suporte/*.tsx`, `QuickCalculator`.  
   - Dependências: Tarefa 2.  
   - Benefício: consistência visual e foco no tema central.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase1-forms-filtros`.  
   - Riscos: filtros podem mudar altura; revisar layout após troca.

4) Definir tokens de tipografia e aplicar em headers principais  
   - Descrição: documentar escala (display/h1/h2/h3/body/caption) e aplicar em `PageShell` e títulos de páginas sem wrapper (devolucoes, conta/perfil, rastreio público).  
   - Arquivos/rotas: `components/shared/PageShell.tsx`, `app/(envio)/devolucoes/page.tsx`, `app/(envio)/conta/perfil/page.tsx`, `app/rastreio/[code]/PublicTrackingClient.tsx`.  
   - Dependências: Tarefa 1.  
   - Benefício: hierarquia visual coerente.  
   - Prioridade: Média | Esforço: Baixo-Médio | Branch: `feat/ui-fase1-tipografia`.  
   - Riscos: mínimos; conferir contraste.

**Critérios de aceite da fase**
- Nenhum uso de `NEW_THEME_ENABLED` nos wrappers e páginas de auth.
- Tokens e CSS vars alinhados (cores primária/secondary/border/bg) sem duplicações conflitantes.
- Filtros e formulários mencionados usam `ELButton/ELInput/ELSelect/ELFormItem`.
- Títulos de páginas básicas usam escala tipográfica definida.

**Checklist de QA/Testes**
- Fluxos de auth: login, cadastro, reset/verify.  
- Filtros: coletas, shipments, rastreamento, extrato, faturas.  
- Navegação geral para validar cores e fontes globais.  
- Verificar contraste e foco em botões/inputs.

## Fase 2 – Tabelas e responsividade de listas
**Objetivo**: Criar e aplicar um wrapper `DataTable` responsivo, com toolbar de filtros consistente, reduzindo scroll horizontal bruto em mobile.

**Escopo**: tabelas e blocos de filtros associados das páginas de listas. Fora: ajustes de layout de dashboard e modais.

### Tarefas
1) Criar `DataTable` responsivo em `components/ui`  
   - Descrição: componente que encapsula headerBg, radius 12, empty state padrão, `scroll` inteligente (`max-content`), densidades e toolbar de filtros stackable.  
   - Arquivos: `components/ui/DataTable` (novo), reuse tokens de `lib/ui/theme.ts`.  
   - Dependências: Fase 1 tokens.  
   - Benefício: base única para listas.  
   - Prioridade: Alta | Esforço: Médio | Branch: `feat/ui-fase2-datatable`.

2) Aplicar `DataTable` em Shipments e Coletas  
   - Descrição: substituir `Table` manual e Tag colors por versão com toolbar responsiva; mapear status via tokens semânticos.  
   - Arquivos/rotas: `app/(envio)/shipments/page.tsx`, `app/(envio)/coletas/page.tsx`.  
   - Dependências: Tarefa 1; status tokens na fase 4 são desejáveis mas não bloqueiam.  
   - Benefício: maior uso mobile e consistência.  
   - Prioridade: Alta | Esforço: Médio | Branch: `feat/ui-fase2-datatable-shipments-coletas`.  
   - Riscos: ações críticas (cancelar, divergência) devem continuar acessíveis.

3) Aplicar `DataTable` em Rastreamento e Etiquetas  
   - Descrição: migrar tabelas de `/rastreamento` e `/etiquetas` para o wrapper, revisando colunas mínimas e ações (abrir modal/imprimir).  
   - Arquivos/rotas: `app/(envio)/rastreamento/page.tsx`, `app/(envio)/etiquetas/EtiquetasClient.tsx`.  
   - Dependências: Tarefa 1.  
   - Benefício: UX mobile e empty states padronizados.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase2-datatable-rastreamento-etiquetas`.  
   - Riscos: largura de colunas; validar modais de etiquetas.

4) Aplicar `DataTable` em Carteira (Extrato/Faturas)  
   - Descrição: migrar tabelas financeiras, garantir filtros stack em mobile, ajustar `scroll`.  
   - Arquivos/rotas: `app/(envio)/carteira/extrato`, `app/(envio)/carteira/faturas`.  
   - Dependências: Tarefa 1.  
   - Benefício: leitura em telas pequenas e consistência com financeiro.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase2-datatable-carteira`.  
   - Riscos: formatos de moeda/data; rever paginação.

**Critérios de aceite da fase**
- Shipments, Coletas, Rastreamento, Etiquetas, Extrato e Faturas usando `DataTable` com toolbar responsiva.
- Nenhum overflow horizontal bruto em mobile para essas listas.
- Empty states padronizados (mensagem/ação) nas tabelas migradas.

**Checklist de QA/Testes**
- Responsividade: breakpoints sm/md/lg para cada lista.  
- Ações principais: imprimir etiquetas, cancelar/envio, abrir detalhes, filtros.  
- Paginação e ordenação permanecem funcionais.  
- Empty/loading states exibidos corretamente.

## Fase 3 – Layouts, grids e PageShell
**Objetivo**: Harmonizar espaçamentos, gutters e containers, reduzindo CSS inline e diferenças de layout entre páginas.

**Escopo**: PageShell, DashboardShell/Sidebar, páginas de overview, carteira, suporte, minha conta, e containers públicos. Fora: modais/drawers (fase 4).

### Tarefas
1) Padronizar PageShell (padding/gap por breakpoint)  
   - Descrição: expor props para `containerWidth` e ajustes de sticky em mobile; definir padding 24/16 (desk/mobile).  
   - Arquivos: `components/shared/PageShell.tsx`.  
   - Dependências: Fase 1 tipografia.  
   - Benefício: ritmo visual consistente.  
   - Prioridade: Alta | Esforço: Baixo | Branch: `feat/ui-fase3-pageshell`.

2) Ajustar DashboardShell/Sidebar para tokens de cor e altura fluida  
   - Descrição: substituir hardcode do sidebar (#0A2955) por token brand ou primário, remover `height: 100vh`/`overflow: hidden` no Content em mobile, alinhar trigger/header com spacing tokens.  
   - Arquivos: `components/layout/dashboard-shell.tsx`, `components/layout/Sidebar.tsx`.  
   - Dependências: Fase 1 tokens.  
   - Benefício: navegação consistente e sem cortes em mobile.  
   - Prioridade: Alta | Esforço: Médio | Branch: `feat/ui-fase3-dashboard-shell`.  
   - Riscos: comportamento de colapso em breakpoints; testar.

3) Harmonizar grids e gutters em Overview, Carteira, Suporte e Minha Conta  
   - Descrição: aplicar padrões de gutter `[12,12]`/`[16,16]` e padding de seções, remover `style` inline e `Card` borderless ad-hoc; usar `ELCard` onde fizer sentido.  
   - Arquivos/rotas: `app/(envio)/(overview)/OverviewClient.tsx`, `app/(envio)/carteira/page.tsx`, `suporte/*.tsx`, `minha-conta/MinhaContaClient.tsx`.  
   - Dependências: Tarefa 1 da fase e Fase 1 wrappers.  
   - Benefício: legibilidade e consistência.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase3-layouts-principais`.  
   - Riscos: alturas de cards do dashboard; revisar em desktop/mobile.

4) Normalizar containers públicos e placeholders  
   - Descrição: aplicar PageShell/variante pública em `/rastreio/[code]`, `/devolucoes`, `/conta/perfil`, removendo estilos inline e alinhando padding.  
   - Arquivos/rotas: `app/rastreio/[code]/PublicTrackingClient.tsx`, `app/(envio)/devolucoes/page.tsx`, `app/(envio)/conta/perfil/page.tsx`.  
   - Dependências: Tarefa 1 da fase.  
   - Benefício: experiência coesa também fora do dashboard.  
   - Prioridade: Baixa | Esforço: Baixo | Branch: `feat/ui-fase3-public-containers`.  
   - Riscos: mínimos.

**Critérios de aceite da fase**
- PageShell com padding/gap documentados e aderidos nas páginas citadas.
- Sidebar e DashboardShell usam cores/token e não causam overflow em mobile.
- Overview, Carteira, Suporte, Minha Conta sem CSS inline de layout/gutter divergente.
- Páginas públicas/placeholders com container consistente.

**Checklist de QA/Testes**
- Responsividade do layout geral (abrir/fechar sidebar em mobile).  
- Páginas: overview, carteira, suporte, minha conta, rastreio público.  
- Scroll vertical não é bloqueado em mobile.  
- Checar alinhamento de títulos/ações no sticky do PageShell.

## Fase 4 – Modais, status e refinamentos de UX
**Objetivo**: Unificar modais/drawers, tokens de status e feedbacks (alerts/empty), e ajustar botões de ação customizados.

**Escopo**: modais/drawers de checkout, pagamentos, etiquetas, suporte; tags/status; alerts/empty states; botões customizados. Fora: tema/base já cobertos.

### Tarefas
1) Criar presets de modal/drawer  
   - Descrição: definir estilos padrão (radius 12, header denso, footer alinhado, larguras por tipo) e aplicar em `CheckoutModal`, `CheckoutCartModal`, `LabelPrintModal`, `ShipmentLabelModal`, `StatementPDFModal`, `TicketDetailsDrawer`.  
   - Arquivos/rotas: `components/payments/*Modal.tsx`, `components/labels/*Modal.tsx`, `app/(envio)/shipments/ShipmentsClient.tsx` (modal de divergência), `components/support/TicketDetailsDrawer.tsx`.  
   - Dependências: Fase 1 wrappers.  
   - Benefício: UX previsível e acessível.  
   - Prioridade: Alta | Esforço: Médio | Branch: `feat/ui-fase4-modais`.

2) Unificar tokens de status/tags  
   - Descrição: criar mapa central de status/cores e aplicar em `TrackingStatusTag`, `PickupStatusTag`, status em Shipments/Coletas/Rastreamento/Support; remover hardcodes de `STATUS_COLORS`.  
   - Arquivos/rotas: `components/ui/TrackingStatusTag.tsx`, `components/ui/PickupStatusTag.tsx`, `app/(envio)/shipments/ShipmentsClient.tsx`, `app/(envio)/coletas/ColetasClient.tsx`, `app/(envio)/rastreamento/page.tsx`, `support` components.  
   - Dependências: Tarefa 1 (pode ser paralelo).  
   - Benefício: semântica e manutenção simples.  
   - Prioridade: Alta | Esforço: Médio | Branch: `feat/ui-fase4-status-tokens`.  
   - Riscos: garantir contraste e legendas corretas.

3) Padronizar alerts/empty e botões de ação custom  
   - Descrição: substituir alerts/empty avulsos por `ELEmpty` e alerts tonais, ajustar botões custom (ex.: divergência em shipments, copiar código em rastreio público) para `ELButton` com ícones/tamanhos.  
   - Arquivos/rotas: `app/(envio)/shipments/ShipmentsClient.tsx`, `app/(envio)/carteira/*.tsx`, `app/(envio)/cotacoes/*` (banners), `app/rastreio/[code]/PublicTrackingClient.tsx`, `suporte/*.tsx`.  
   - Dependências: Fase 1 wrappers.  
   - Benefício: feedback visual consistente e acessível.  
   - Prioridade: Média | Esforço: Médio | Branch: `feat/ui-fase4-feedbacks`.  
   - Riscos: não perder mensagens críticas de erro.

4) Ajustar wizards e fluxos multi-step  
   - Descrição: alinhar padrões de steps/footer sticky em `cotacoes/finalizar` e `PickupWizard`; remover CSS inline de loading em `layout.tsx`/`LayoutWrapper` em favor de presets.  
   - Arquivos/rotas: `app/(envio)/cotacoes/finalizar/*`, `components/pickups/PickupWizard.tsx`, `app/(envio)/LayoutWrapper.tsx`.  
   - Dependências: Fase 1/3 (layout/padding).  
   - Benefício: ergonomia em fluxos longos.  
   - Prioridade: Média | Esforço: Médio-Alto | Branch: `feat/ui-fase4-wizards`.  
   - Riscos: fluxo de compra; testar end-to-end.

**Critérios de aceite da fase**
- Modais/drawers citados usam preset com radius/padding/largura padrão e botões alinhados.
- Status em Shipments/Coletas/Rastreamento/Support usam mapa central sem hardcodes.
- Botões custom migrados para ELButton; alerts/empty padronizados.
- Wizards com footer sticky consistente e sem loaders inline improvisados.

**Checklist de QA/Testes**
- Fluxo de checkout (cotacoes/finalizar), pagamento do carrinho, geração de etiquetas.  
- Modais: checkout, faturas, etiquetas, divergência, suporte.  
- Status/tags em tabelas e timelines.  
- Responsividade de modais/drawers em sm/md.

## Cronograma sugerido
1. Fase 1 (Fundamentos) – desbloqueia demais fases.  
2. Fase 2 (Tabelas) – depende dos tokens/wrappers.  
3. Fase 3 (Layouts) – pode rodar em paralelo ao final da Fase 2, mas publicar depois para evitar conflitos de padding.  
4. Fase 4 (Modais/Status/UX) – após Fase 2 (para status em tabelas) e com PageShell ajustado (Fase 3) para wizards.

## Riscos gerais e mitigação
- **Impacto em rotas críticas (cotação, checkout, wallet)**: manter branches pequenos e feature flags se necessário; smoke test diário.  
- **Quebra de responsividade ao trocar componentes**: validar breakpoints e usar `DataTable` com variações antes de remover tabelas antigas.  
- **Sidebar/header afetando navegação**: testar em dispositivos reais/DevTools mobile.  
- **Degradação de acessibilidade**: garantir foco visível em ELButton e aria-labels em ações icônicas.

## Observações finais
- Manter alinhamento com UX/PO para escolhas de cores de status e comportamento de wizards.  
- Evitar adicionar novas dependências; aproveitar AntD e wrappers EL existentes.  
- Cada branch deve ser pequena e revisada com checklist de QA da fase correspondente.  
- Registrar decisões de tokens/status em documentação curta no repositório (README de UI ou docs/).  
