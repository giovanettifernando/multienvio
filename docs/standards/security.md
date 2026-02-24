# Security Baseline - Envio Legal

Este documento consolida o que ja esta implementado e o que e obrigatorio por padrao.

## 1) Autenticacao e Sessoes
- **JWT clientes**: access + refresh, TTL curto/longo e `tokenVersion`. Evidencia: `modules/auth/application/jwt-tokens.ts`.
- **Sessao admin separada** (cookie `admin_auth`, audience/issuer especificos). Evidencia: `modules/auth/application/admin-session.ts`.
- **Sessoes de coletores/pontos** com segredo proprio. Evidencia: `modules/auth/application/collector-session.ts`.
- **Token rotation** no refresh (incrementa `tokenVersion`). Evidencias: `platform/auth/refresh-handler.ts`, `app/api/auth/refresh/route.ts`, `app/api/admin/auth/refresh/route.ts`.
- **Idle timeout** configuravel (admin e cliente), excecao documentada para coletor/ponto. Evidencia: `proxy.ts`.

## 2) Secrets obrigatorios
- `JWT_SECRET`, `ADMIN_JWT_SECRET`, `COLLECTOR_JWT_SECRET` obrigatorios em producao. Evidencias: `modules/auth/application/jwt-tokens.ts`, `modules/auth/application/admin-session.ts`, `modules/auth/application/collector-session.ts`, `proxy.ts`.
- Validacao centralizada de envs criticos no bootstrap do DB. Evidencia: `platform/db/env-validation.ts`.

## 3) RBAC e Protecao de Rotas
- **RBAC admin** por permissoes. Evidencias: `modules/auth/application/permissions.ts`, `modules/admin/application/nav.ts`.
- **Protecao centralizada por path** (admin/auth/collector/pickup). Evidencia: `modules/auth/application/route-protection.ts`.
- **Defesa em profundidade**: `/api/*` exige auth se nao for explicitamente publico. Evidencia: `modules/auth/application/route-protection.ts`.

## 4) Rate Limiting
- **Redis + fallback local** (fail-open). Evidencia: `platform/cache/rate-limit-redis.ts`.
- **Strict** (fail-close em producao) para login/sensiveis. Evidencia: `platform/cache/rate-limit-redis.ts`.
- Configs pre-definidas (LOGIN, FINANCE, WRITE...). Evidencia: `platform/cache/rate-limit-redis.ts`.

## 5) Idempotencia
- Idempotencia distribuida com Redis (fail-close em producao). Evidencia: `platform/api/idempotency.ts`.
- Checkout usa idempotencia. Evidencia: `app/api/checkout/route.ts`.

## 6) Webhooks
- Validacao HMAC com `timingSafeEqual`. Evidencia: `platform/api/webhook-auth.ts`.
- Tracking webhook valida assinatura, status final e transicoes. Evidencia: `app/api/webhooks/tracking/route.ts`.
- Mercado Pago exige segredo de webhook. Evidencia: `platform/integrations/mercadopago/webhooks.ts`.

## 7) Uploads e Arquivos
- Validacao de conteudo por magic bytes. Evidencia: `platform/storage/file-validation.ts`.
- Uploads de suporte/despesas com checagem de ownership e path traversal. Evidencia: `app/api/uploads/[...path]/route.ts`.
- Upload publico de documentos de coletor com rate limit e magic bytes. Evidencia: `app/api/public/upload/collector-document/route.ts`.

## 8) Logs e PII
- Logger estruturado com `redact` de dados sensiveis. Evidencia: `platform/logging/logger.ts`.
- Logs de auditoria para acoes admin. Evidencia: `platform/logging/audit-admin.ts`.
- Auditoria de mudanca de status de shipments. Evidencia: `modules/shipments/application/shipment-audit.ts`.

## 9) Headers e CSP
- CSP e headers de seguranca configurados no Next.js. Evidencia: `next.config.ts`.
- CORS para `/api/*` com origem configuravel. Evidencia: `next.config.ts`.

## 10) Criptografia de PAN (cartoes)
- AES-256-GCM para PAN e rotacao de chave. Evidencia: `platform/crypto/card-vault.ts`.

## 11) OAuth / CSRF
- Google OAuth usa state persistido e validado (CSRF + open redirect). Evidencia: `modules/auth/application/google-oauth.ts`.

## 12) Itens obrigatorios para toda rota sensivel
- [ ] Autenticacao/authorization (`requireUserSession`/`requireAdminSession`). Evidencia: `platform/auth/require-session.ts`.
- [ ] Validacao Zod + `ApiError`. Evidencias: `shared/validation/*`, `platform/api/errors.ts`.
- [ ] Rate limit (login, financeiro, mutacoes). Evidencia: `platform/cache/rate-limit-redis.ts`.
- [ ] Idempotencia em operacoes financeiras. Evidencia: `platform/api/idempotency.ts`.
- [ ] Audit log quando aplicavel. Evidencias: `platform/logging/audit-admin.ts`, `modules/shipments/application/shipment-audit.ts`.

## 13) Itens inconsistentes ou pendentes
- Enum legado de `ShipmentStatus` em `shared/types/contracts.ts` conflita com modelo oficial. Evidencias: `shared/types/contracts.ts`, `modules/shipments/application/shipment-status.ts`.
- Uso parcial de EL components (risco de UI drifts). Evidencia: `docs/el-components-migration-audit.md`.
