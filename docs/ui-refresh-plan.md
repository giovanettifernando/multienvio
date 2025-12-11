# Plano de Modernização Visual

## Áreas de maior impacto (prioridade)
1) Listagem de envios `/shipments` (remetente) e tabelas correlatas (extrato/carteira, coletas, etiquetas).  
2) Listagens do admin (coletores, contas, suporte, financeiro) e dashboards de collector/coletor público.  
3) Tela de rastreio público `/rastreio/[code]` e fluxos de autenticação (logins/cadastros).  
4) Componentes estruturais (cards, modais, filtros, sidebar/header) compartilhados entre produtos.

## Fase 1 — Fundamentos (tipografia, cores, tokens)
- **Componentes/arquivos**: `app/globals.css`, `lib/ui/theme.ts` (tokens de cor/neutros/line-height), `components/shared/PageShell.module.css`, `components/layout/Sidebar.tsx` + `UserPanel.module.css`, botões/inputs (`components/ui/ELButton.*`, `ELInput.*`, `ELStatusTag.*`, `ELTag.*`).
- **Rotas afetadas**: todas do grupo remetente, admin, collector, público (efeito global).
- **Ganhos esperados**: escala tipográfica consistente (13–24px), paleta unificada com tints de estado, redução de sombras pesadas, headers e sidebars alinhados à marca. Admin/collector passam a herdar o mesmo set de tokens (eliminação do azul default AntD).

## Fase 2 — Tabelas e listagens (inclui envios)
- **Componentes/arquivos**: `components/ui/DataTable.tsx` + `DataTable.module.css`, `components/ui/ELTableWrapper.module.css`, tabelas específicas (`app/(envio)/shipments/ShipmentsClient.tsx`, `components/ui/shipments-table.tsx`, `components/collectors/CollectorsTable.tsx`, tabelas de carteira/extrato, coletas/pickups, etiquetas, suporte/admin). Ajustar `Action` columns e paginação.
- **Rotas afetadas**: `/shipments`, `/coletas`, `/carteira/*`, `/etiquetas`, `/suporte`, `/admin/*` listagens, `/collector` dashboard/listas, `/coletores/*`.
- **Ganhos esperados**: cabeçalhos Title Case 13px, linhas 52–56px com padding 12–16, zebra/hover legível, status pills unificados, ações agrupadas (dropdown), eliminação de `scrollY calc(100vh - 340px)` e ícones poluentes. A listagem de envios deixa de parecer “bruta” e ganha hierarquia (código + destinatário, status mais elegante, ações priorizadas).

## Fase 3 — Cards, modais, filtros, formulários
- **Componentes/arquivos**: `components/ui/ELCard.*`, `ELModal.*`, `ELDrawer.*`, `ActionBar.*`, `ELFormItem.*`, `ELSelect.*`, `ELEmpty.*`, `ELSkeleton.*`. Form layouts em `/cotacoes/*`, `/carrinho`, `/minha-conta`, `/admin/login`, `/collector/login`, `/coletores/login` etc.
- **Rotas afetadas**: todas as que exibem cards/forms/modais (cotações, pagamento, carteira, suporte, admin/collector CRUDs e logins públicos).
- **Ganhos esperados**: cards com sombra/borda suaves, modais com tamanhos padronizados (sm–xl/full), barras de filtro destacadas, inputs/botões alinhados à nova escala, experiência de login/cadastro e formulários internos com mesma hierarquia e estados visuais.

## Fase 4 — Refinos e estados
- **Componentes/arquivos**: estados vazios/loading (`ELEmpty`, `ELSkeleton`, placeholders), badges secundárias (coleta, status público), timelines (`components/track/*`), banners/alerts (`ELAlert`), microinterações (hover/focus).
- **Rotas afetadas**: `/rastreio/[code]`, `/suporte/*`, dashboards, telas vazias em tabelas, skeletons globais.
- **Ganhos esperados**: mensagens vazias/coaching copy consistentes, skeletons com tints da paleta, foco/hover perceptíveis, estados de processamento/erro alinhados. Mobile/tablet se beneficiam de gaps/paddings revisados.

## Critérios de sucesso
- Paleta e tipografia aplicadas de forma consistente em remetente, admin e collector (sem azul AntD residual).
- Leituras confortáveis em 1366×768, 1920×1080 e mobile (densidade de tabela e paddings ajustados por breakpoint, sem rolagem dupla).
- Listagem de envios e tabelas principais com hierarquia clara (título/subtítulo, status legível, ações agrupadas) e aparência moderna/unificada.
- Nenhum componente aparentando pertencer a outro produto: cards, modais, badges, filtros e botões compartilham radius, cores e pesos definidos no design system.
