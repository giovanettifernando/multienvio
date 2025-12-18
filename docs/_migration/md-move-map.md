
# Mapa de Migração de Markdown

## Objetivo
Rastrear a movimentação de todos os arquivos `.md` para `docs/`, mantendo histórico e justificativas.

## Escopo
- Inclui todos os `.md` versionados (exceto artefatos gerados em `test-results/**`, mantidos no lugar por serem saídas de teste).
- Status possíveis: `MOVED` (realocado), `ARCHIVED` (guardado como histórico), `MERGED` (conteúdo consolidado em outro doc), `DELETED` (não usado; evitar sempre que possível).

## Critérios de aceite / Checklist
- [x] Todos os `.md` versionados aparecem no mapa.
- [x] Itens arquivados trazem justificativa ou fonte de verdade.
- [x] Exceções de artefatos gerados estão documentadas no escopo.

## Mapeamento
| Antigo | Novo | Status | Nota |
| --- | --- | --- | --- |
| ADMIN_USUARIOS_RELATORIO.md | docs/architecture/admin/admin-usuarios-relatorio.md | MOVED |  |
| CLIENT_PAGES_CODE_EXAMPLES.md | docs/ui-ux/patterns/client-pages-code-examples.md | MOVED |  |
| CLIENT_PAGES_STRUCTURE.md | docs/archive/client-pages-structure.md | ARCHIVED | Documento pré-migração de tema; manter apenas como histórico. |
| CODE_REVIEW_REPORT-V2.md | docs/audits/code/code-review-report.md | MOVED |  |
| CODE_REVIEW_REPORT.md | docs/archive/code-review-report-v1.md | ARCHIVED | Relatório V1; V2 consolidado como canônico. |
| COLLECTOR_DOCUMENTS_IMPLEMENTATION.md | docs/architecture/collectors/documents-implementation.md | MOVED |  |
| COLLECTOR_LOGIN_IMPLEMENTATION.md | docs/architecture/auth/collector-login-implementation.md | MOVED |  |
| CORRECOES.md | docs/archive/correcoes.md | ARCHIVED | Histórico de correções iniciais. |
| COTACOES_ADDRESS_RECIPIENT_SELECT.md | docs/ui-ux/quotes/address-recipient-select.md | MOVED |  |
| DEBUG_QUOTE_VALIDATION.md | docs/operations/troubleshooting/debug-quote-validation.md | MOVED |  |
| docs/analise-campos-sem-uso-v2.md | docs/audits/database/analise-campos-sem-uso-v2.md | MOVED |  |
| docs/analise-campos-sem-uso.md | docs/archive/audits/analise-campos-sem-uso.md | ARCHIVED | Versão anterior; v2 é a referência. |
| docs/antd-audit.md | docs/audits/frontend/antd-audit.md | MOVED |  |
| docs/api-contracts.md | docs/architecture/api/api-contracts.md | MOVED |  |
| docs/API_ACCOUNT_CARDS.md | docs/architecture/api/api-account-cards.md | MOVED |  |
| docs/API_ACCOUNT_ME.md | docs/architecture/api/api-account-me.md | MOVED |  |
| docs/API_ACCOUNT_RECIPIENTS.md | docs/architecture/api/api-account-recipients.md | MOVED |  |
| docs/API_ACCOUNT_SECURITY.md | docs/architecture/api/api-account-security.md | MOVED |  |
| docs/ARCHITECTURE_PAYMENTS_WALLET.md | docs/architecture/payments/architecture-payments-wallet.md | MOVED |  |
| docs/ASSISTANT_CHAT_AUDIT_REPORT.md | docs/audits/code/assistant-chat-audit-report.md | MOVED |  |
| docs/auditoria-adm.md | docs/audits/architecture/auditoria-adm.md | MOVED |  |
| docs/auditoria-sessao-v2.md | docs/archive/security/auditoria-sessao-v2.md | ARCHIVED | Segunda revisão; v3 é a fonte de verdade. |
| docs/auditoria-sessao-v3.md | docs/audits/security/auditoria-sessao-v3.md | MOVED |  |
| docs/auditoria-sessao.md | docs/archive/security/auditoria-sessao-v1.md | ARCHIVED | Primeira revisão de sessão; v3 é a fonte de verdade. |
| docs/AUTH_IMPLEMENTATION.md | docs/architecture/auth/auth-implementation.md | MOVED |  |
| docs/AUTH_TOKEN_VERSION.md | docs/architecture/auth/auth-token-version.md | MOVED |  |
| docs/CEP_MANAGEMENT.md | docs/operations/troubleshooting/cep-management.md | MOVED |  |
| docs/contracts-inventory.md | docs/architecture/contracts-inventory.md | MOVED |  |
| docs/db-audit-evidence.md | docs/audits/database/db-audit-evidence.md | MOVED |  |
| docs/db-audit-migration-plan.md | docs/operations/migrations/db-audit-migration-plan.md | MOVED |  |
| docs/db-audit-report.md | docs/audits/database/db-audit-report.md | MOVED |  |
| docs/dead-code-audit.md | docs/audits/code/dead-code-audit.md | MOVED |  |
| docs/dead-code-removal-plan.md | docs/audits/code/dead-code-removal-plan.md | MOVED |  |
| docs/duplication-audit.md | docs/audits/code/duplication-audit.md | MOVED |  |
| docs/fluxos-envio-legal.md | docs/architecture/flows/fluxos-envio-legal.md | MOVED |  |
| docs/forms-inventory.md | docs/ui-ux/forms-inventory.md | MOVED |  |
| docs/implementacao-responsividade.md | docs/ui-ux/responsiveness/implementacao-responsividade.md | MOVED |  |
| docs/inconsistencia-de-fluxos.md | docs/audits/architecture/inconsistencia-de-fluxos.md | MOVED |  |
| docs/integrations-backend.md | docs/integrations/overview-backend.md | MOVED |  |
| docs/manual-usuario-remetente.md | docs/guides/manual-usuario-remetente.md | MOVED |  |
| docs/mercadopago-pending-contingency-report.md | docs/integrations/mercadopago/pending-contingency-report.md | MOVED |  |
| docs/padronizacao-componentes.md | docs/ui-ux/design-system/padronizacao-componentes.md | MOVED |  |
| docs/PAGAMENTOS_REMOCAO_MOCKS.md | docs/integrations/mercadopago/remocao-mocks.md | MOVED |  |
| docs/PASSWORD_CHANGE_FIX.md | docs/operations/troubleshooting/password-change-fix.md | MOVED |  |
| docs/PASSWORD_RESET_IMPLEMENTATION.md | docs/architecture/auth/password-reset-implementation.md | MOVED |  |
| docs/payments-mercadopago.md | docs/integrations/mercadopago/payments-mercadopago.md | MOVED |  |
| docs/pentest-report-v2.md | docs/audits/security/pentest-report-v2.md | MOVED |  |
| docs/pentest-report.md | docs/archive/audits/pentest-report-v1.md | ARCHIVED | Primeiro ciclo de pentest; v2 cobre correções. |
| docs/plano-execucao-responsividade.md | docs/archive/ui-ux/responsiveness/plano-execucao-responsividade.md | ARCHIVED | Plano inicial substituído pelo v3 em ui-ux/responsiveness. |
| docs/plano-execucao-ui-envio-legal.md | docs/ui-ux/responsiveness/plano-execucao-ui-envio-legal.md | MOVED |  |
| docs/plano-modernizacao-ui-envio-legal.md | docs/ui-ux/design-system/plano-modernizacao-ui-envio-legal.md | MOVED |  |
| docs/POSTGIS_MIGRATION.md | docs/operations/migrations/postgis-migration.md | MOVED |  |
| docs/project-reorg-plan.md | docs/architecture/project-reorg-plan.md | MOVED |  |
| docs/project-structure-audit.md | docs/audits/architecture/project-structure-audit.md | MOVED |  |
| docs/proposta-refatoracao-cotacoes.md | docs/ui-ux/quotes/refatoracao-cotacoes.md | MOVED |  |
| docs/PUBLIC-TRACKING-PAGE-REFACTOR.md | docs/ui-ux/tracking/public-tracking-page-refactor.md | MOVED |  |
| docs/quotation-backend.md | docs/architecture/quotes/quotation-backend.md | MOVED |  |
| docs/RESPONSIVE_FIX_PLAN.md | docs/archive/ui-ux/responsiveness/responsive-fix-plan.md | ARCHIVED | Plano preliminar; implementação final documentada em implementacao-responsividade. |
| docs/responsividade-auditoria.md | docs/archive/ui-ux/responsiveness/responsividade-auditoria.md | ARCHIVED | Auditoria inicial; ver implementacao-responsividade para estado atual. |
| docs/responsividade-modelo-global.md | docs/archive/ui-ux/responsiveness/responsividade-modelo-global.md | ARCHIVED | Modelo proposto antes da execução; mantido como referência histórica. |
| docs/revisao-rotas-e-apis-remetente-v2.md | docs/audits/routes/revisao-rotas-e-apis-remetente-v2.md | MOVED |  |
| docs/revisao-rotas-e-apis-remetente.md | docs/archive/audits/revisao-rotas-e-apis-remetente.md | ARCHIVED | Substituído pela revisão v2. |
| docs/SECRET_ROTATION.md | docs/operations/security/secret-rotation.md | MOVED |  |
| docs/security-audit-report.md | docs/audits/security/security-audit-report.md | MOVED |  |
| docs/security-cleanup-plan.md | docs/operations/security/security-cleanup-plan.md | MOVED |  |
| docs/SECURITY_TESTING.md | docs/operations/testing/security-testing.md | MOVED |  |
| docs/SHIPMENT-DETAILS-REFACTOR.md | docs/ui-ux/shipments/shipment-details-refactor.md | MOVED |  |
| docs/SHIPMENT-DETAILS-VOLUME-EXPANSION.md | docs/ui-ux/shipments/shipment-details-volume-expansion.md | MOVED |  |
| docs/SHIPMENTS-VOLUMES-FIX.md | docs/operations/troubleshooting/shipments-volumes-fix.md | MOVED |  |
| docs/standardization-plan.md | docs/ui-ux/design-system/standardization-plan.md | MOVED |  |
| docs/STATUS-INITIAL-FIX.md | docs/architecture/shipments/status-initial-fix.md | MOVED |  |
| docs/STATUS-MIGRATION-ANALYSIS.md | docs/architecture/shipments/status-migration-analysis.md | MOVED |  |
| docs/STATUS-REFACTOR-SUMMARY.md | docs/architecture/shipments/status-refactor-summary.md | MOVED |  |
| docs/tests/relatorio-responsividade-remetente.md | docs/operations/testing/responsividade/relatorio-responsividade-remetente.md | MOVED |  |
| docs/tests/responsividade-remetente-mapa-rotas.md | docs/operations/testing/responsividade/responsividade-remetente-mapa-rotas.md | MOVED |  |
| docs/tests/testids-remetente.md | docs/operations/testing/responsividade/testids-remetente.md | MOVED |  |
| docs/TRACKING-EVENTS-FIX.md | docs/operations/troubleshooting/tracking-events-fix.md | MOVED |  |
| docs/ui-design-system-v2.md | docs/ui-ux/design-system/ui-design-system-v2.md | MOVED |  |
| docs/ui-refresh-plan.md | docs/ui-ux/ui-refresh-plan.md | MOVED |  |
| docs/ui-ux-audit-plan.md | docs/ui-ux/audits/ui-ux-audit-plan.md | MOVED |  |
| docs/ui-visual-audit.md | docs/ui-ux/audits/ui-visual-audit.md | MOVED |  |
| docs/wallet-refactoring.md | docs/architecture/payments/wallet-refactoring.md | MOVED |  |
| FIX_DOCUMENT_PERSISTENCE.md | docs/operations/troubleshooting/fix-document-persistence.md | MOVED |  |
| FIX_HEADER_CEP_FINAL.md | docs/operations/troubleshooting/fix-header-cep-final.md | MOVED |  |
| FIX_HEADER_ORIGEM.md | docs/operations/troubleshooting/fix-header-origem.md | MOVED |  |
| FIX_QUOTE_CALCULATION_ERROR.md | docs/operations/troubleshooting/fix-quote-calculation-error.md | MOVED |  |
| HARMONIZACAO_RELATORIO.md | docs/ui-ux/harmonizacao-relatorio.md | MOVED |  |
| QA_REPORT_COTACOES.md | docs/audits/qa/qa-report-cotacoes.md | MOVED |  |
| QUOTE_NAVIGATION_BUTTONS.md | docs/ui-ux/quotes/quote-navigation-buttons.md | MOVED |  |
| README.md | docs/README.md | MOVED | Índice principal reescrito; raiz mantém stub apontando para docs/. |
| scripts/README-GEOCODING.md | docs/operations/scripts/geocoding.md | MOVED |  |
| scripts/README-PICKUP-FEE.md | docs/operations/scripts/pickup-fee.md | MOVED |  |
| SECURITY.md | docs/operations/security/security-overview.md | MOVED |  |
