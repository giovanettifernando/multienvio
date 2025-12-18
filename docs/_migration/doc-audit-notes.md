# Notas de Auditoria da Documentação

## Objetivo
Registrar o estado de cada documento após a reorganização, indicando utilidade, necessidade de revisão e fonte de verdade quando há versões concorrentes.

## Legenda
- `KEEP`: válido e canônico.
- `REFRESH`: precisa de atualização para refletir o estado atual ou aplicar o template padrão.
- `MERGE`: conteúdo consolidado em outro doc (consultar fonte de verdade).
- `ARCHIVE`: mantido apenas como histórico.

## Escopo
- Todos os `.md` em `docs/`, incluindo índices e artefatos desta migração.
- Artefatos gerados em `test-results/**` ficam fora do inventário (saída de testes automatizados).

## Critérios de aceite / Checklist
- [x] Cada documento classificado como `KEEP`, `REFRESH`, `MERGE` ou `ARCHIVE`.
- [x] Fontes de verdade indicadas sempre que há versões concorrentes.
- [x] Itens que exigem atualização marcados como `REFRESH`.

### index
| Documento | Classificação | Nota | Fonte de verdade |
| --- | --- | --- | --- |
| README.md | KEEP | Índice principal de navegação. |  |
| SUMMARY.md | KEEP | Árvore linear de leitura. |  |

### _migration
| Documento | Classificação | Nota | Fonte de verdade |
| --- | --- | --- | --- |
| _migration/doc-audit-notes.md | KEEP | Este inventário. |  |
| _migration/md-move-map.md | KEEP | Mapa old→new desta migração. |  |

### architecture
| Documento | Classificação | Nota | Fonte de verdade |
| --- | --- | --- | --- |
| architecture/admin/admin-usuarios-relatorio.md | KEEP |  |  |
| architecture/api/api-account-cards.md | KEEP |  |  |
| architecture/api/api-account-me.md | KEEP |  |  |
| architecture/api/api-account-recipients.md | KEEP |  |  |
| architecture/api/api-account-security.md | KEEP |  |  |
| architecture/api/api-contracts.md | KEEP |  |  |
| architecture/auth/auth-implementation.md | KEEP |  |  |
| architecture/auth/auth-token-version.md | KEEP |  |  |
| architecture/auth/collector-login-implementation.md | KEEP |  |  |
| architecture/auth/password-reset-implementation.md | KEEP |  |  |
| architecture/collectors/documents-implementation.md | KEEP |  |  |
| architecture/contracts-inventory.md | KEEP |  |  |
| architecture/flows/fluxos-envio-legal.md | REFRESH | Atualizar rotas/serviços conforme estrutura vigente. |  |
| architecture/payments/architecture-payments-wallet.md | KEEP |  |  |
| architecture/payments/wallet-refactoring.md | KEEP |  |  |
| architecture/project-reorg-plan.md | REFRESH | Revalidar o plano frente à reorganização atual. |  |
| architecture/quotes/quotation-backend.md | KEEP |  |  |
| architecture/shipments/status-initial-fix.md | KEEP |  |  |
| architecture/shipments/status-migration-analysis.md | KEEP |  |  |
| architecture/shipments/status-refactor-summary.md | KEEP |  |  |

### integrations
| Documento | Classificação | Nota | Fonte de verdade |
| --- | --- | --- | --- |
| integrations/mercadopago/payments-mercadopago.md | KEEP |  |  |
| integrations/mercadopago/pending-contingency-report.md | KEEP |  |  |
| integrations/mercadopago/remocao-mocks.md | KEEP |  |  |
| integrations/overview-backend.md | KEEP |  |  |

### operations
| Documento | Classificação | Nota | Fonte de verdade |
| --- | --- | --- | --- |
| operations/migrations/db-audit-migration-plan.md | REFRESH | Revisar à luz do schema/migrações mais recentes. |  |
| operations/migrations/postgis-migration.md | KEEP |  |  |
| operations/scripts/geocoding.md | KEEP |  |  |
| operations/scripts/pickup-fee.md | KEEP |  |  |
| operations/security/secret-rotation.md | KEEP |  |  |
| operations/security/security-cleanup-plan.md | REFRESH | Checar pendências remanescentes do cleanup. |  |
| operations/security/security-overview.md | KEEP |  |  |
| operations/testing/responsividade/relatorio-responsividade-remetente.md | REFRESH | Reexecutar após estabilização da UI e env vars. |  |
| operations/testing/responsividade/responsividade-remetente-mapa-rotas.md | KEEP |  |  |
| operations/testing/responsividade/testids-remetente.md | KEEP |  |  |
| operations/testing/security-testing.md | KEEP |  |  |
| operations/troubleshooting/cep-management.md | KEEP |  |  |
| operations/troubleshooting/debug-quote-validation.md | KEEP |  |  |
| operations/troubleshooting/fix-document-persistence.md | KEEP |  |  |
| operations/troubleshooting/fix-header-cep-final.md | KEEP |  |  |
| operations/troubleshooting/fix-header-origem.md | KEEP |  |  |
| operations/troubleshooting/fix-quote-calculation-error.md | KEEP |  |  |
| operations/troubleshooting/password-change-fix.md | KEEP |  |  |
| operations/troubleshooting/shipments-volumes-fix.md | KEEP |  |  |
| operations/troubleshooting/tracking-events-fix.md | KEEP |  |  |

### ui-ux
| Documento | Classificação | Nota | Fonte de verdade |
| --- | --- | --- | --- |
| ui-ux/audits/ui-ux-audit-plan.md | KEEP |  |  |
| ui-ux/audits/ui-visual-audit.md | KEEP |  |  |
| ui-ux/design-system/padronizacao-componentes.md | KEEP |  |  |
| ui-ux/design-system/plano-modernizacao-ui-envio-legal.md | KEEP |  |  |
| ui-ux/design-system/standardization-plan.md | KEEP |  |  |
| ui-ux/design-system/ui-design-system-v2.md | KEEP |  |  |
| ui-ux/forms-inventory.md | KEEP |  |  |
| ui-ux/harmonizacao-relatorio.md | KEEP |  |  |
| ui-ux/patterns/client-pages-code-examples.md | KEEP |  |  |
| ui-ux/quotes/address-recipient-select.md | KEEP |  |  |
| ui-ux/quotes/quote-navigation-buttons.md | KEEP |  |  |
| ui-ux/quotes/refatoracao-cotacoes.md | REFRESH | Plano de UI; alinhar com a versão atual de cotações. |  |
| ui-ux/responsiveness/implementacao-responsividade.md | KEEP |  |  |
| ui-ux/responsiveness/plano-execucao-ui-envio-legal.md | KEEP |  |  |
| ui-ux/shipments/shipment-details-refactor.md | KEEP |  |  |
| ui-ux/shipments/shipment-details-volume-expansion.md | KEEP |  |  |
| ui-ux/tracking/public-tracking-page-refactor.md | KEEP |  |  |
| ui-ux/ui-refresh-plan.md | REFRESH | Sincronizar com entregas da modernização v3. |  |

### audits
| Documento | Classificação | Nota | Fonte de verdade |
| --- | --- | --- | --- |
| audits/architecture/auditoria-adm.md | KEEP |  |  |
| audits/architecture/inconsistencia-de-fluxos.md | KEEP |  |  |
| audits/architecture/project-structure-audit.md | KEEP |  |  |
| audits/code/assistant-chat-audit-report.md | KEEP |  |  |
| audits/code/code-review-report.md | KEEP |  |  |
| audits/code/dead-code-audit.md | KEEP |  |  |
| audits/code/dead-code-removal-plan.md | REFRESH | Depende de nova rodada de identificação de código morto. |  |
| audits/code/duplication-audit.md | KEEP |  |  |
| audits/database/analise-campos-sem-uso-v2.md | KEEP |  |  |
| audits/database/db-audit-evidence.md | KEEP |  |  |
| audits/database/db-audit-report.md | KEEP |  |  |
| audits/frontend/antd-audit.md | KEEP |  |  |
| audits/qa/qa-report-cotacoes.md | KEEP |  |  |
| audits/routes/revisao-rotas-e-apis-remetente-v2.md | KEEP |  |  |
| audits/security/auditoria-sessao-v3.md | KEEP |  |  |
| audits/security/pentest-report-v2.md | KEEP |  |  |
| audits/security/security-audit-report.md | KEEP |  |  |

### guides
| Documento | Classificação | Nota | Fonte de verdade |
| --- | --- | --- | --- |
| guides/manual-usuario-remetente.md | KEEP |  |  |

### archive
| Documento | Classificação | Nota | Fonte de verdade |
| --- | --- | --- | --- |
| archive/audits/analise-campos-sem-uso.md | ARCHIVE | Versão anterior; mantida como referência. | audits/database/analise-campos-sem-uso-v2.md |
| archive/audits/pentest-report-v1.md | ARCHIVE | Primeiro ciclo; v2 contém as correções validadas. | audits/security/pentest-report-v2.md |
| archive/audits/revisao-rotas-e-apis-remetente.md | ARCHIVE | Substituído pela revisão v2. | audits/routes/revisao-rotas-e-apis-remetente-v2.md |
| archive/client-pages-structure.md | ARCHIVE | Documento pré-tema v3; usar os materiais do design system. | ui-ux/design-system/ui-design-system-v2.md |
| archive/code-review-report-v1.md | ARCHIVE | Relatório original; V2 é o canônico. | audits/code/code-review-report.md |
| archive/correcoes.md | ARCHIVE | Histórico das primeiras correções. | operations/troubleshooting/ |
| archive/security/auditoria-sessao-v1.md | ARCHIVE | Rodada inicial; versão v3 é a fonte de verdade. | audits/security/auditoria-sessao-v3.md |
| archive/security/auditoria-sessao-v2.md | ARCHIVE | Rodada intermediária; versão v3 é a fonte de verdade. | audits/security/auditoria-sessao-v3.md |
| archive/ui-ux/responsiveness/plano-execucao-responsividade.md | ARCHIVE | Plano inicial substituído pelo v3. | ui-ux/responsiveness/plano-execucao-ui-envio-legal.md |
| archive/ui-ux/responsiveness/responsive-fix-plan.md | ARCHIVE | Plano preliminar; ver implementação final. | ui-ux/responsiveness/implementacao-responsividade.md |
| archive/ui-ux/responsiveness/responsividade-auditoria.md | ARCHIVE | Auditoria inicial de responsividade. | ui-ux/responsiveness/implementacao-responsividade.md |
| archive/ui-ux/responsiveness/responsividade-modelo-global.md | ARCHIVE | Modelo proposto antes da execução. | ui-ux/responsiveness/implementacao-responsividade.md |
