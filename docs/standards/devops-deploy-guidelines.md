# DevOps/Deploy Guidelines - Envio Legal

## 1) Ambientes e variaveis
- Validacao de envs criticos (DB, JWT secrets). Evidencia: `platform/db/env-validation.ts`.
- `.env` e `.env.local` detectados para DB. Evidencia: `platform/db/database.ts`.

## 2) Banco e infra local
- Postgres local via Docker Compose. Evidencia: `_infra/postgres/docker-compose.yml`.

## 3) Build e start
- `npm run build`, `npm run start`, `npm run dev`/`dev:turbo`. Evidencia: `package.json`.

## 4) Migrations
- `npx prisma migrate dev`/`deploy` conforme scripts. Evidencia: `package.json`.
- Checagem de migrations no startup (pode ser desativada). Evidencia: `platform/db/db.ts`.

## 5) Logs
- Pino com rotacao (`pino-roll`) em producao. Evidencia: `platform/logging/logger.ts`.

## 6) Health checks
- Rotas de health: `/api/health`, `/api/health/db`, `/api/health/dependencies`. Evidencias: `app/api/health/route.ts`, `app/api/health/db/route.ts`, `app/api/health/dependencies/route.ts`.

## 7) Deploy sem dor (passo a passo)
- [ ] Rodar migrations.
- [ ] Garantir Redis disponivel (tokens, rate limit, idempotencia).
- [ ] Setar secrets obrigatorios (`JWT_SECRET`, `ADMIN_JWT_SECRET`, `COLLECTOR_JWT_SECRET`, `DATABASE_URL`).
- [ ] Verificar health endpoints apos deploy.

## 8) CI (parcial)
- Workflow de auditoria de formularios roda em `push`/`pull_request` e usa Node 20. Evidencia: `.github/workflows/forms-inventory.yml`.
