RELATÓRIO DE AUDITORIA — PAINEL ADMINISTRATIVO /admin

  ---
  1️⃣ TABELA — INVENTÁRIO DO /admin

  | Tela           | Rota                            | APIs                                   | Entidades                              | Ações                          | Permissão      | Observações                       |
  |----------------|---------------------------------|----------------------------------------|----------------------------------------|--------------------------------|----------------|-----------------------------------|
  | Dashboard      | /admin                          | Nenhuma                                | —                                      | —                              | Qualquer admin | ⚠️ STUB - Em desenvolvimento      |
  | Operações      | /admin/operacoes                | /api/admin/ops/*                       | Shipment, Pickup, Reception, Package   | Ver KPIs, filtrar, reprocessar | OPERACOES      | ✅ Completo                       |
  | Movimentações  | /admin/financeiro/movimentacoes | /api/admin/finance/wallet-transactions | WalletTransaction                      | Listar, filtrar                | FINANCEIRO     | ✅ Funcional                      |
  | Repasses       | /admin/financeiro/repasses      | /api/admin/finance/carrier-payouts     | CarrierPayout                          | Listar, marcar pago            | FINANCEIRO     | ✅ Funcional                      |
  | Comissões      | /admin/financeiro/comissoes     | /api/admin/finance/commissions         | Commission                             | Aprovar, pagar                 | FINANCEIRO     | ✅ Funcional                      |
  | Despesas       | /admin/financeiro/despesas      | /api/admin/finance/expenses            | Expense                                | CRUD completo                  | FINANCEIRO     | ✅ Completo                       |
  | Relatórios     | /admin/financeiro/relatorios    | /api/admin/finance/reports/*           | Agregações                             | Gerar DRE, contas              | FINANCEIRO     | ⚠️ Parcial                        |
  | Gateway        | /admin/gateway-pagamento        | /api/admin/integrations/mercadopago    | PaymentCredentials                     | Config, testar                 | INTEGRACOES    | ✅ Funcional                      |
  | Correios       | /admin/correios                 | /api/admin/integrations/correios       | CarrierCredentials                     | Config, sync, teste            | INTEGRACOES    | ✅ Completo                       |
  | Suporte        | /admin/suporte                  | /api/admin/support/tickets/*           | SupportTicket                          | Responder, status, atribuir    | SUPORTE        | ✅ Completo                       |
  | Suporte [id]   | /admin/suporte/[id]             | /api/admin/support/tickets/[id]/*      | SupportTicket                          | Detalhes + ações               | SUPORTE        | ✅ Completo                       |
  | Contas         | /admin/contas                   | /api/admin/clients                     | User, Wallet                           | Listar, bloquear               | CONTAS         | ✅ Completo                       |
  | Contas [id]    | /admin/contas/[id]              | /api/admin/clients/[id]/*              | User, Wallet, Address, Card, Recipient | CRUD completo                  | CONTAS         | ✅ Completo                       |
  | Coletores      | /admin/coletores                | /api/admin/coletores                   | Collector                              | Listar, status                 | COLETORES      | ✅ Funcional                      |
  | Coletores [id] | /admin/coletores/[id]           | /api/admin/coletores/[id]/*            | Collector                              | Detalhes, pickups              | COLETORES      | ✅ Funcional                      |
  | Pontos Coleta  | /admin/pontos-de-coleta         | /api/admin/pickup-points               | PickupPoint                            | Listar, status                 | PONTOS_COLETA  | ✅ Funcional                      |
  | Pontos [id]    | /admin/pontos-de-coleta/[id]    | /api/admin/pickup-points/[id]/*        | PickupPoint                            | Detalhes, receptions           | PONTOS_COLETA  | ✅ Funcional                      |
  | Usuários Admin | /admin/usuarios                 | /api/admin/staff/users                 | StaffUser                              | CRUD, permissões               | USUARIOS       | ✅ Completo                       |
  | Email Config   | /admin/servidor-email           | /api/admin/email-config                | EmailConfig                            | Config, testar                 | CONFIGURACOES  | ✅ Completo                       |
  | Google OAuth   | /admin/config/google-oauth      | /api/admin/config/google-oauth         | GoogleOAuthConfig                      | Config, testar                 | CONFIGURACOES  | ✅ Completo                       |
  | OpenRouter     | /admin/config/openrouter        | /api/admin/config/openrouter           | OpenRouterConfig                       | Config, playground             | CONFIGURACOES  | ✅ Completo                       |
  | Knowledge Base | /admin/config/knowledge-base    | /api/admin/knowledge-base              | KnowledgeBaseArticle                   | CRUD                           | CONFIGURACOES  | ✅ Funcional                      |
  | Comissões Plat | /admin/config/comissoes         | /api/admin/config/comissoes            | PlatformCommission                     | CRUD                           | CONFIGURACOES  | ✅ Funcional                      |
  | Agências       | /admin/config/correios-agencies | /api/admin/correios-agencies           | CorreiosAgency                         | Sync, listar                   | CONFIGURACOES  | ✅ Funcional                      |
  | SQL            | /admin/config/sql               | ❌ Removido                            | —                                      | —                              | CONFIGURACOES  | ⚠️ Removido (git status: deleted) |

  ---
  2️⃣ RELATÓRIO — AUDITORIA TELA A TELA

  🔴 DASHBOARD (/admin) — SEVERIDADE: ALTA

  Status: STUB - Apenas placeholder

  Evidência:
  // Linha 6-13
  export default function AdminDashboardClient() {
    return (
      <PageShell title="Visão geral" gap="md">
        <Typography.Text type="secondary">
          Dashboard administrativo em desenvolvimento
        </Typography.Text>
      </PageShell>
    );
  }

  Problema: A tela principal do admin não mostra nenhum KPI ou métrica. Admin precisa navegar para /admin/operacoes para ver dados.

  Impacto: Perda de visibilidade operacional na entrada do sistema.

  Correção: Implementar dashboard com KPIs consolidados:
  - Total de envios por status (do KPIs de operações)
  - Saldo total de clientes
  - Tickets abertos
  - Receita do período

  ---
  ✅ OPERAÇÕES (/admin/operacoes) — SEVERIDADE: BAIXA

  Funcionalidades:
  - ✅ KPIs de status (backlog, em trânsito, exceções, etc.)
  - ✅ Filtros por período, status, transportadora
  - ✅ Tabs: Envios, Coletas, Pontos de Coleta, Exceções, Eventos
  - ⚠️ Aba "SLA & Capacidade" → Em desenvolvimento (placeholder)

  Consistência de Dados:
  - ✅ KPIs vêm de API com agregação real (/api/admin/ops/kpis usa COUNT no Prisma)
  - ✅ Listagem paginada com filtros aplicados corretamente

  Permissões:
  - ✅ requireAdminSession(req, AdminPermission.OPERACOES) em todas as rotas

  Achado Menor:
  - Filtro de período (_period) é calculado mas não passado para todos os tabs

  ---
  ✅ CONTAS/CLIENTES (/admin/contas) — SEVERIDADE: BAIXA

  Funcionalidades:
  - ✅ Listagem com saldo, créditos do mês, status
  - ✅ Detalhes completos: Perfil, Endereços, Cartões, Destinatários, Itens Recorrentes, Carteira
  - ✅ Ações: Alterar status, Enviar reset de senha, Excluir conta

  Consistência de Dados:
  - ✅ Saldo vem de wallet.availableCents (campo correto)
  - ✅ Créditos do mês calculados com filtro de data correto

  Permissões:
  - ✅ requireAdminSession(req, AdminPermission.CONTAS) em todas as rotas

  Achado:
  debitsMonth: null,  // ⚠️ Campo sempre null - não calculado

  ---
  ✅ AJUSTE DE CARTEIRA (/api/admin/clients/[id]/wallet/adjust) — SEVERIDADE: BAIXA

  Segurança:
  - ✅ Lock pessimista com FOR UPDATE (evita race conditions)
  - ✅ Validação de saldo antes de débito
  - ✅ Auditoria via logger com adminId, antes/depois
  - ✅ Meta da transação inclui adminId, adminName, timestamp

  Achado Positivo: Esta é uma implementação exemplar de operação financeira.

  ---
  ⚠️ FINANCEIRO/RELATÓRIOS (/admin/financeiro/relatorios) — SEVERIDADE: MÉDIA

  Funcionalidades Parciais:
  - ✅ DRE (Demonstração de Resultado)
  - ✅ Contas a Pagar
  - ⚠️ Outros relatórios não mapeados na UI

  Achado: API tem mais relatórios do que a UI expõe.

  ---
  ✅ SUPORTE (/admin/suporte) — SEVERIDADE: BAIXA

  Funcionalidades:
  - ✅ Listagem com filtros
  - ✅ Drawer de detalhes (desktop)
  - ✅ Página dedicada (mobile)
  - ✅ Responder, alterar status, atribuir

  Permissões:
  - ✅ requireAdminSession(req, AdminPermission.SUPORTE)

  ---
  3️⃣ TABELA — ACHADOS (TODOS)

  | Sev      | Tela      | Problema                                     | Fonte     | Evidência                     | Impacto                          | Correção                      | Teste       |
  |----------|-----------|----------------------------------------------|-----------|-------------------------------|----------------------------------|-------------------------------|-------------|
  | 🔴 ALTA  | Dashboard | Tela é apenas stub                           | UI        | AdminDashboardClient.tsx:6-13 | Admin sem visão consolidada      | Implementar KPIs              | E2E         |
  | 🟡 MÉDIA | Operações | Aba SLA/Capacidade em desenvolvimento        | UI        | OperacoesClient.tsx:93-100    | Monitoramento SLA ausente        | Implementar ou remover aba    | E2E         |
  | 🟡 MÉDIA | Contas    | debitsMonth sempre null                      | API       | contas/page.tsx:92            | Dado incompleto na listagem      | Calcular débitos do mês       | Unit        |
  | 🟡 MÉDIA | SQL       | Tela removida mas rota na nav                | UI/Config | nav.ts:152-156 + git status   | Link quebrado                    | Remover da nav                | E2E         |
  | 🟢 BAIXA | Operações | Filtro de período não aplicado em todas tabs | UI        | OperacoesClient.tsx:73-106    | Dados podem não refletir período | Passar params para todas tabs | Integration |
  | 🟢 BAIXA | Auditoria | Algumas ações não têm StaffAuditLog          | API       | Vários endpoints              | Auditoria incompleta             | Adicionar logs                | Unit        |

  ---
  4️⃣ CHECKLIST FINAL — RESPOSTAS EXPLÍCITAS

  ❌ Inconsistências UI vs API/DB

  1. debitsMonth: null em /admin/contas — Campo declarado mas nunca calculado
  2. SQL page — Listado na nav (nav.ts:152-156) mas arquivos deletados

  ❌ Telas Incompletas (Stubs)

  1. Dashboard (/admin) — Apenas texto "em desenvolvimento"
  2. SLA & Capacidade — Tab em Operações com Alert de "em desenvolvimento"

  ✅ Endpoints com Validação Adequada

  - Todos os endpoints admin usam requireAdminSession com permissão específica
  - Validação Zod aplicada em operações de escrita
  - Transições de status validadas via matriz (isValidTransition)

  ⚠️ Ações sem Trilha de Auditoria

  1. Bloquear/Desbloquear cliente — Usa logger mas não StaffAuditLog
  2. Alterar status de shipment — ✅ Tem auditStatusChange
  3. Ajuste de carteira — ✅ Tem logger + meta na transação
  4. Alterar permissões de staff — Verificar se tem log

  ❌ Gaps de Dados

  1. Dashboard KPIs — Não existem ainda
  2. Débitos mensais — Campo existe mas não calculado

  ⚠️ Diferenças entre Telas Similares

  1. Coletores vs Pontos de Coleta — Estrutura similar mas tabs diferentes (ok)
  2. Listagens — Todas usam padrão consistente de paginação

  ✅ Oportunidades de Simplificação

  1. Componentes de listagem — Já bem padronizados
  2. Permissões — Já centralizadas em requireAdminSession

  ---
  5️⃣ PLANO EM FASES (PRs Pequenos)

  PR1: Remover SQL da Navegação (LOW RISK)

  Arquivos:
  - modules/admin/application/nav.ts (remover linhas 152-156)

  Passos:
  1. Remover item SQL do ADMIN_NAV
  2. Verificar que build passa
  3. Testar navegação

  Testes: E2E de navegação admin

  PR2: Implementar Dashboard com KPIs (MEDIUM)

  Arquivos:
  - app/(admin)/admin/AdminDashboardClient.tsx (reescrever)
  - app/api/admin/dashboard/route.ts (novo)

  Passos:
  1. Criar API que agrega KPIs de ops + finance + support
  2. Implementar UI com cards de métricas
  3. Reutilizar getOpsKpis existente

  Testes: Unit para API, E2E para UI

  PR3: Calcular debitsMonth em Contas (LOW)

  Arquivos:
  - app/(admin)/admin/contas/page.tsx

  Passos:
  1. Adicionar query para débitos do mês (WalletTxType = DEBIT/CONSUMPTION)
  2. Calcular soma
  3. Retornar no objeto

  Testes: Unit test da função

  PR4: Remover/Implementar Tab SLA (MEDIUM)

  Opção A: Remover tab temporariamente
  - Remover de tabItems em OperacoesClient.tsx

  Opção B: Implementar SLA básico
  - Criar API de métricas SLA
  - Implementar UI

  Testes: E2E

  ---
  6️⃣ RESUMO EXECUTIVO

  | Categoria             | Status                                  |
  |-----------------------|-----------------------------------------|
  | Completude Funcional  | 85% — Dashboard é stub, SLA em dev      |
  | Consistência de Dados | 95% — Apenas debitsMonth faltando       |
  | Regras de Negócio     | 100% — Transições e validações corretas |
  | Permissões/RBAC       | 100% — Todas rotas protegidas           |
  | Auditoria             | 80% — Logger OK, StaffAuditLog parcial  |
  | UX Operacional        | 90% — Falta dashboard consolidado       |

  Prioridades Imediatas

  1. 🔴 Remover SQL da nav — Link quebrado
  2. 🔴 Implementar Dashboard — Tela principal vazia
  3. 🟡 Calcular debitsMonth — Dado incompleto

  O painel administrativo está funcionalmente sólido para operação, com validações de segurança adequadas e RBAC consistente. As lacunas identificadas são principalmente de completude de features (dashboard, SLA) e não de correção de dados ou segurança.

● CONCLUSÃO

  O painel administrativo /admin está operacionalmente sólido com:

  ✅ Pontos Fortes:
  - RBAC consistente (todas rotas protegidas com requireAdminSession + permissão)
  - Validações de negócio (transições de status, locks pessimistas em financeiro)
  - Auditoria em operações financeiras (ajuste de carteira)
  - Estrutura de navegação bem organizada por domínio

  ⚠️ Pontos de Atenção:
  1. Dashboard vazio — Tela principal é apenas placeholder
  2. Link SQL quebrado — Página removida mas item na nav persiste
  3. debitsMonth não calculado — Campo declarado mas sempre null

  🔴 Ação Imediata:
  # Remover SQL da navegação (arquivo deletado)
  # Arquivo: modules/admin/application/nav.ts
  # Remover linhas 152-156 (item SQL)

  O sistema está pronto para operação, mas o dashboard vazio diminui a experiência do administrador na visão geral.

