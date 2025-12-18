# Documentação Envio Legal

## Objetivo
Centralizar todos os materiais de produto, arquitetura, operações e auditoria em um único índice navegável.

## Escopo
- Todos os `.md` versionados foram movidos para `docs/` (exceto artefatos gerados em `test-results/**`).
- Estrutura baseada em categorias: guias, arquitetura, integrações, operações, UI/UX, auditorias e arquivo histórico.

## Estrutura (categorias)
- **Guides**: onboarding e uso geral (`guides/manual-usuario-remetente.md`).
- **Architecture**: decisões de módulos, contratos de API, autenticação, pagamentos e status de envios (`architecture/**`).
- **Integrations**: visão geral e docs por provedor, como Mercado Pago (`integrations/mercadopago/*`).
- **Operations**: segurança, migrações, scripts operacionais, troubleshooting e relatórios de teste (`operations/**`).
- **UI/UX**: design system, responsividade, planos de refatoração e inventários de UI (`ui-ux/**`).
- **Audits**: relatórios de segurança, banco de dados, código, rotas e QA (`audits/**`).
- **Archive**: materiais obsoletos preservados com notas de substituição (`archive/**`).
- **Migration**: rastreabilidade desta reorganização (`_migration/*`).

## Onde encontro X?
- **Deploy/segurança**: `operations/security/security-overview.md`, `operations/security/secret-rotation.md`.
- **Integração Mercado Pago**: `integrations/mercadopago/payments-mercadopago.md`, `integrations/mercadopago/pending-contingency-report.md`.
- **Status e lifecycle de envios**: `architecture/shipments/status-refactor-summary.md`, `architecture/shipments/status-migration-analysis.md`.
- **Responsividade e UI**: `ui-ux/responsiveness/implementacao-responsividade.md`, `ui-ux/design-system/ui-design-system-v2.md`.
- **Auditorias críticas (security/db)**: `audits/security/pentest-report-v2.md`, `audits/database/db-audit-report.md`.
- **Scripts e runbooks**: `operations/scripts/geocoding.md`, `operations/scripts/pickup-fee.md`, troubleshooting em `operations/troubleshooting/*`.

## Passos / Referências
- Navegação linear: `SUMMARY.md`.
- Mapa completo de movimentação: `_migration/md-move-map.md`.
- Classificação e fonte de verdade: `_migration/doc-audit-notes.md`.
- Arquivo histórico: `archive/` (use apenas para consulta).

## Critérios de aceite / Checklist
- [ ] Nenhum `.md` fora de `docs/` (exceto artefatos gerados em `test-results/**` e este README na raiz).
- [ ] Links internos atualizados após a migração.
- [ ] Documentos canônicos identificados e redundâncias arquivadas ou consolidadas.
- [ ] Índice (`README.md` e `SUMMARY.md`) cobre todas as categorias.
