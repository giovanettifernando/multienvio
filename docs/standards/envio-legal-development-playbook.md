# Envio Legal - Standard Development Playbook

Documento de referencia unico para desenvolvimento no Envio Legal.

- **Objetivo:** registrar a verdade do codigo, padroes e decisoes ja aplicadas, e o que e recomendado/pendente.
- **Regra de ouro:** nenhuma afirmacao sem evidencia no repositorio.

## Legenda de Padroes
- **(A) Implementado**: existe no codigo e e usado de forma consistente.
- **(B) INCONSISTENTE**: existe em alguns lugares, mas nao e uniforme.
- **(C) Ausente/RECOMENDADO**: desejado, mas nao ha implementacao atual no codigo.

## Sumario
- [Quick Start Standard](#quick-start-standard)
- [Mapa do Repositorio e Navegacao](#mapa-do-repositorio-e-navegacao)
- [Stack e Tecnologias (com versoes)](#stack-e-tecnologias-com-versoes)
- [Arquitetura Atual](#arquitetura-atual)
- [Matriz de Padroes (A/B/C)](#matriz-de-padroes-abc)
- [Seguranca Baseline (resumo)](#seguranca-baseline-resumo)
- [Regras de Dominio e Invariantes (resumo)](#regras-de-dominio-e-invariantes-resumo)
- [Banco de Dados (resumo)](#banco-de-dados-resumo)
- [Redis e Cache (resumo)](#redis-e-cache-resumo)
- [Frontend/UI (resumo)](#frontendui-resumo)
- [Backend (resumo)](#backend-resumo)
- [APIs e Contratos (resumo)](#apis-e-contratos-resumo)
- [Testes e Qualidade (resumo)](#testes-e-qualidade-resumo)
- [DevOps/Deploy (resumo)](#devopsdeploy-resumo)
- [Lessons Learned e Anti-padroes](#lessons-learned-e-anti-padroes)
- [Checklists (copiar/colar)](#checklists-copiarcolar)
- [Apendices](#apendices)

---

## Quick Start Standard
Guia rapido (1-2 paginas) para iniciar uma feature nova com o padrao atual.

### 1) Comece pelo mapa certo
- Identifique a area (admin, envio, auth, collector, public) pelo diretorio em `app/**` e modulos em `modules/**`. Evidencias: `app/(admin)`, `app/(envio)`, `app/(auth)`, `app/(collector)`, `app/(public)`, `modules/*`.
- Logica de dominio fica em `modules/*/application` e integracoes/infra em `modules/*/infra` ou `platform/*`. Evidencias: `modules/shipments/application`, `modules/shipments/infra`, `platform/integrations/*`.

### 2) Fluxo padrao para uma nova feature
1) **Descrever o fluxo** e seus status/estados (checar enums no Prisma e status oficiais). Evidencias: `prisma/schema.prisma`, `modules/shipments/application/shipment-status.ts`.
2) **Criar/atualizar schemas Zod** em `shared/validation/*`. Evidencias: `shared/validation/*`.
3) **Implementar a logica** em `modules/<domain>/application/*`. Evidencias: `modules/cart/application/*`, `modules/wallet/application/*`.
4) **Expor API** usando `withApiHandler` (ou `withApiHandlerResponse` quando precisa de cookies/arquivo/binary). Evidencias: `platform/api/handler.ts`, `app/api/**/route.ts`.
5) **Garantir seguranca**: sessao obrigatoria + RBAC + rate limit + idempotencia quando necessario. Evidencias: `platform/auth/require-session.ts`, `modules/auth/application/permissions.ts`, `platform/cache/rate-limit-redis.ts`, `platform/api/idempotency.ts`.
6) **UI** usando componentes EL (`shared/ui`) e tokens de tema. Evidencias: `shared/ui/index.ts`, `shared/ui/theme.ts`, `app/globals.css`.
7) **Log e audit** para operacoes sensiveis. Evidencias: `platform/logging/logger.ts`, `platform/logging/audit-admin.ts`, `modules/shipments/application/shipment-audit.ts`.

### 3) Comandos principais
- Dev: `npm run dev` (Webpack) ou `npm run dev:turbo` (Turbopack). Evidencia: `package.json`.
- Build: `npm run build` (ou `npm run build:webpack`). Evidencia: `package.json`.
- DB (Prisma): `npm run db:migrate`, `npm run db:push`, `npm run db:seed`, `npm run db:studio`. Evidencia: `package.json`.
- Testes: `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`. Evidencia: `package.json`.

### 4) Checklist minimo (rapido)
- [ ] Zod schema definido e usado no handler. Evidencias: `shared/validation/*`, `app/api/**/route.ts`.
- [ ] Usa `withApiHandler` e envelope padrao de resposta. Evidencias: `platform/api/handler.ts`, `platform/api/response.ts`.
- [ ] Sessao obrigatoria + RBAC correto. Evidencias: `platform/auth/require-session.ts`, `modules/auth/application/permissions.ts`.
- [ ] Rate limit aplicado em operacoes sensiveis. Evidencia: `platform/cache/rate-limit-redis.ts`.
- [ ] Idempotencia em operacoes financeiras/checkout. Evidencia: `platform/api/idempotency.ts`.
- [ ] Logs e auditoria em operacoes administrativas/financeiras. Evidencias: `platform/logging/audit-admin.ts`, `modules/wallet/application/*`.

---

## Mapa do Repositorio e Navegacao

### Estrutura principal (como navegar)
- **`app/**`**: Next.js App Router (rotas, layouts, UI). Evidencias: `app/layout.tsx`, `app/(envio)/*`, `app/api/**/route.ts`.
- **`modules/**`**: modulos de dominio com camadas `api/application/domain/infra/ui/dto`. Evidencias: `modules/shipments/*`, `modules/payments/*`, `modules/wallet/*`.
- **`platform/**`**: infraestrutura compartilhada (auth, cache, db, logging, integracoes). Evidencias: `platform/auth/*`, `platform/cache/*`, `platform/db/*`, `platform/integrations/*`.
- **`shared/**`**: UI, tipos, validacoes, utils. Evidencias: `shared/ui/*`, `shared/types/*`, `shared/validation/*`.
- **`prisma/**`**: schema + migrations + seeds. Evidencias: `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`.
- **`docs/**`**: documentacao viva (arquitetura, integracoes, operacoes, auditorias). Evidencias: `docs/README.md`, `docs/architecture/*`, `docs/operations/*`.
- **`tests/**`**: unit, integration e e2e. Evidencias: `tests/unit`, `tests/integration`, `tests/e2e`.
- **`_infra/**`**: infraestrutura local (Postgres via Docker). Evidencia: `_infra/postgres/docker-compose.yml`.

### Mapa de pastas e responsabilidades

| Pasta | Responsabilidade | Evidencia |
| --- | --- | --- |
| `app/(admin)` | Portal admin (UI + layout + rotas) | `app/(admin)/admin/layout.tsx` |
| `app/(envio)` | Portal do cliente (UI + layout + rotas) | `app/(envio)/EnvioLayoutClient.tsx` |
| `app/(auth)` | UI de autenticacao | `app/(auth)/auth/*` |
| `app/(collector)` | Portal de coletores/pontos | `app/(collector)/collector/*` |
| `app/(public)` | Paginas publicas (pagar, coletor etc.) | `app/(public)/*` |
| `app/api` | API Routes Next.js | `app/api/**/route.ts` |
| `modules/*/application` | Regras de negocio e servicos | `modules/cart/application/*` |
| `modules/*/ui` | UI de dominio | `modules/labels/ui/*` |
| `platform/*` | Infra (auth, db, cache, logging, integracoes) | `platform/auth/*`, `platform/db/*`, `platform/cache/*` |
| `shared/ui` | Design System EL (wrappers AntD) | `shared/ui/index.ts` |
| `shared/validation` | Zod schemas | `shared/validation/*` |
| `prisma` | Schema e migracoes | `prisma/schema.prisma` |
| `docs` | Arquitetura e operacoes | `docs/README.md` |

---

## Stack e Tecnologias (com versoes)

### Tecnologias principais

| Tecnologia | Versao | Uso real | Evidencia |
| --- | --- | --- | --- |
| Next.js | `^16.0.4` | App Router + API Routes | `package.json`, `app/*`, `app/api/*` |
| React | `^19.2.0` | UI | `package.json`, `app/**/*.tsx` |
| TypeScript | `^5` | Base do projeto | `package.json`, `tsconfig.json` |
| Node.js | `>=24.0.0` | Runtime | `package.json` |
| Prisma | `^7.0.1` | ORM + migrations | `package.json`, `prisma/schema.prisma` |
| PostgreSQL | via `pg` | Banco relacional | `package.json`, `platform/db/db.ts` |
| Redis | via `ioredis` | Sessions, cache, rate limit | `package.json`, `platform/cache/redis.ts` |
| Ant Design | `^6.0.0` | UI base + wrappers EL | `package.json`, `shared/ui/*` |
| React Query | `^5.90.2` | Client data fetching | `shared/ui/providers/app-providers.tsx` |
| Zod | `^4.1.12` | Validation | `shared/validation/*`, `platform/api/errors.ts` |
| Pino | `^10.1.0` | Logging | `platform/logging/logger.ts` |
| Playwright | `^1.56.1` | E2E | `playwright.config.ts` |
| Node test runner | nativo | Unit/Integration | `package.json`, `tests/register.js` |

### Configuracao do build/runtime
- Webpack e o default em dev (`next dev --webpack`), Turbopack opcional (`next dev`). Evidencia: `package.json`.
- `optimizePackageImports` para Ant Design e icones. Evidencia: `next.config.ts`.
- `serverExternalPackages` para `pino`, `thread-stream`, `pino-pretty`. Evidencia: `next.config.ts`.
- CSP + headers de seguranca configurados no Next.js. Evidencia: `next.config.ts`.
- `moduleResolution: bundler` e path aliases `@/modules`, `@/shared`, `@/platform`. Evidencia: `tsconfig.json`.

---

## Arquitetura Atual

### Visao geral
- **App Router** com grupos de rota para separar areas: admin, envio, auth, collector, public. Evidencias: `app/(admin)`, `app/(envio)`, `app/(auth)`, `app/(collector)`, `app/(public)`.
- **Camadas por modulo**: `api` (chamadas), `application` (servicos), `domain` (modelos), `infra` (integracoes), `ui` (componentes). Evidencias: `modules/shipments/*`, `modules/payments/*`, `modules/wallet/*`.
- **Infra centralizada em `platform/**`**: auth/sessoes, cache/redis, db/prisma, logging, integracoes. Evidencias: `platform/auth/*`, `platform/cache/*`, `platform/db/*`, `platform/logging/*`, `platform/integrations/*`.

### Fluxo padrao de API
1) `withApiHandler` cria envelope de resposta, logging e requestId. Evidencia: `platform/api/handler.ts`.
2) Zod valida inputs; erros viram `ApiError` com payload padronizado. Evidencias: `platform/api/errors.ts`, `shared/validation/*`.
3) Servicos de dominio executam regras. Evidencia: `modules/*/application/*`.

### Server/Client boundaries
- Componentes server: padrao no App Router; componentes client explicitos com `"use client"`. Evidencias: `app/(envio)/EnvioLayoutClient.tsx`, `shared/ui/providers/app-providers.tsx`.
- `server-only` protege modulos de infra no server. Evidencias: `platform/db/db.ts`, `platform/cache/redis.ts`, `platform/crypto/card-vault.ts`.

### Jobs de background
- Jobs inicializados via `instrumentation.ts` no runtime Node. Evidencia: `instrumentation.ts`.

### Error boundary
- `app/error.tsx` define boundary global. Evidencia: `app/error.tsx`.

---

## Matriz de Padroes (A/B/C)

| Padrao | Status | Evidencia | Observacao |
| --- | --- | --- | --- |
| API envelope `{ data, error, meta }` via `withApiHandler` | (A) | `platform/api/handler.ts`, `platform/api/response.ts` | Usado em rotas `app/api/**/route.ts`. |
| Logger estruturado com redaction | (A) | `platform/logging/logger.ts` | Redact de tokens, secrets e cookies. |
| Sessoes JWT com tokenVersion (Redis) | (A) | `modules/auth/application/jwt-tokens.ts`, `platform/cache/cache.ts` | Fail-close em producao. |
| Protecao de rotas por tipo (admin/auth/collector/pickup) | (A) | `modules/auth/application/route-protection.ts`, `proxy.ts` | API nao explicitamente publica exige auth. |
| Rate limit distribuido (Redis + fallback local) | (A) | `platform/cache/rate-limit-redis.ts` | Fail-open geral; strict para login/sensiveis. |
| Idempotencia com Redis (fail-close em prod) | (A) | `platform/api/idempotency.ts` | Usado no checkout. |
| CSP/CORS/headers de seguranca | (A) | `next.config.ts` | CSP com allowlist e CORS para `/api`. |
| Uploads com validacao de magic bytes | (A) | `platform/storage/file-validation.ts` | Usado em endpoints de upload. |
| EL Design System (wrappers AntD) | (B) | `shared/ui/index.ts`, `docs/el-components-migration-audit.md` | Uso parcial; ainda ha AntD direto. |
| Status oficial de shipments | (B) | `modules/shipments/application/shipment-status.ts`, `shared/types/contracts.ts` | Ha dois enums divergentes. |
| Testes unit/integration via Node test runner | (A) | `package.json`, `tests/register.js` | Vitest config existe, mas nao esta no script. |
| React Query global provider | (A) | `shared/ui/providers/app-providers.tsx` | Admin usa mesmo provider. |
| Docs de arquitetura e integracoes | (A) | `docs/architecture/*`, `docs/integrations/*` | Usadas como fonte de decisao. |
| EL Layout unificado para todos os modulos | (B) | `shared/ui/layout/*`, `docs/el-components-migration-audit.md` | Admin, envio e coletor ainda divergem. |
| Pipeline CI/CD (forms audit) | (B) | `.github/workflows/forms-inventory.yml` | Ha workflow para auditoria de formularios; nao ha pipeline geral de build/teste. |

### INCONSISTENCIAS mapeadas (lista de correcao)
- Status de shipment divergente entre `modules/shipments/application/shipment-status.ts` e `shared/types/contracts.ts`. Evidencias: `modules/shipments/application/shipment-status.ts`, `shared/types/contracts.ts`.
- UI usa AntD direto em varias areas (EL wrappers parciais). Evidencia: `docs/el-components-migration-audit.md`.
- Vitest esta configurado mas nao usado nos scripts. Evidencias: `vitest.config.ts`, `package.json`.

---

## Seguranca Baseline (resumo)
- JWT secrets obrigatorios em producao (client/admin/collector). Evidencias: `modules/auth/application/jwt-tokens.ts`, `modules/auth/application/admin-session.ts`, `modules/auth/application/collector-session.ts`.
- Sessoes com tokenVersion em Redis (fail-close em producao). Evidencias: `modules/auth/application/jwt-tokens.ts`, `platform/cache/cache.ts`.
- Protecao de rotas via `proxy.ts` e `route-protection`. Evidencias: `proxy.ts`, `modules/auth/application/route-protection.ts`.
- RBAC por permissoes no admin. Evidencias: `modules/auth/application/permissions.ts`, `modules/admin/application/nav.ts`.
- Rate limiting por IP/usuario com Redis. Evidencia: `platform/cache/rate-limit-redis.ts`.
- Idempotencia para operacoes criticas (ex: checkout). Evidencia: `platform/api/idempotency.ts`, `app/api/checkout/route.ts`.
- Webhooks com assinatura HMAC e timing-safe compare. Evidencia: `platform/api/webhook-auth.ts`, `app/api/webhooks/tracking/route.ts`.
- Uploads com validacao de magic bytes e protecao de path traversal. Evidencias: `platform/storage/file-validation.ts`, `app/api/uploads/[...path]/route.ts`.
- Headers de seguranca (CSP, HSTS, XFO, etc.). Evidencia: `next.config.ts`.

Detalhes completos em `docs/standards/security.md`.

---

## Regras de Dominio e Invariantes (resumo)
- **Shipment status**: enum oficial em `modules/shipments/application/shipment-status.ts` (fases A-D, labels e cores). Evidencia: `modules/shipments/application/shipment-status.ts`.
- **Quote status / PickupRequest / WalletTx / Expense**: enums no Prisma. Evidencia: `prisma/schema.prisma`.
- **Fluxos detalhados**: descritos em docs de arquitetura. Evidencias: `docs/architecture/flows/fluxos-envio-legal.md`, `docs/architecture/shipments/status-refactor-summary.md`.
- **Auditoria de status**: `auditStatusChange` grava logs (inclui webhooks e admin). Evidencias: `modules/shipments/application/shipment-audit.ts`, `app/api/webhooks/tracking/route.ts`.

Detalhes completos em `docs/standards/architecture.md` e `docs/standards/backend-guidelines.md`.

---

## Banco de Dados (resumo)
- Prisma schema com `@@map` para nomes reais de tabelas e enums. Evidencia: `prisma/schema.prisma`.
- Pool do Postgres via `pg` + adapter Prisma. Evidencia: `platform/db/db.ts`.
- Migrations gerenciadas por Prisma. Evidencias: `prisma/migrations/*`, `prisma.config.ts`.
- Validacao de envs (incluindo DB). Evidencia: `platform/db/env-validation.ts`.

Detalhes completos em `docs/standards/db-prisma-guidelines.md`.

---

## Redis e Cache (resumo)
- Redis usado para sessions, rate limit e idempotencia. Evidencias: `platform/cache/redis.ts`, `platform/cache/cache.ts`, `platform/cache/rate-limit-redis.ts`, `platform/api/idempotency.ts`.
- TTLs e prefixos padronizados. Evidencia: `platform/cache/cache.ts`, `platform/cache/keys.ts`.
- Fail-open para cache de dados, fail-close para seguranca. Evidencia: `platform/cache/cache.ts`.

Detalhes completos em `docs/standards/redis-cache-guidelines.md`.

---

## Frontend/UI (resumo)
- Ant Design com wrappers EL (Design System interno). Evidencias: `shared/ui/index.ts`, `shared/ui/theme.ts`.
- Tokens em `app/globals.css` e `shared/ui/theme.ts`. Evidencias: `app/globals.css`, `shared/ui/theme.ts`.
- Layouts principais: `DashboardShell` (envio) e layout admin. Evidencias: `shared/ui/layout/dashboard-shell.tsx`, `app/(admin)/admin/layout.tsx`.
- React Query com provider global. Evidencia: `shared/ui/providers/app-providers.tsx`.

Detalhes completos em `docs/standards/frontend-guidelines.md`.

---

## Backend (resumo)
- Servicos de dominio por modulo, com validacoes Zod e uso do Prisma. Evidencias: `modules/*/application/*`, `shared/validation/*`, `platform/db/db.ts`.
- Circuit breaker para integracoes externas. Evidencia: `platform/integrations/shared/circuit-breaker.ts`.
- Logs estruturados e audit trails. Evidencias: `platform/logging/logger.ts`, `platform/logging/audit-admin.ts`.

Detalhes completos em `docs/standards/backend-guidelines.md`.

---

## APIs e Contratos (resumo)
- Envelope padrao e `ApiError`. Evidencias: `platform/api/response.ts`, `platform/api/errors.ts`.
- `withApiHandler` e `withApiHandlerResponse`. Evidencia: `platform/api/handler.ts`.
- Paginacao por `page`/`pageSize` (admin) e `limit/offset` (algumas areas). Evidencias: `modules/admin/application/finance/types.ts`, `app/(envio)/pagamentos-pendentes/RecipientPaymentsClient.tsx`.

Detalhes completos em `docs/standards/api-guidelines.md`.

---

## Testes e Qualidade (resumo)
- Unit/Integration com Node test runner (TS via `tests/register.js`). Evidencias: `package.json`, `tests/register.js`.
- E2E com Playwright. Evidencia: `playwright.config.ts`.
- Vitest configurado, mas nao usado nos scripts (inconsistencia). Evidencias: `vitest.config.ts`, `package.json`.

Detalhes completos em `docs/standards/testing-guidelines.md`.

---

## DevOps/Deploy (resumo)
- Postgres local via Docker Compose. Evidencia: `_infra/postgres/docker-compose.yml`.
- Build/start via Next.js scripts. Evidencia: `package.json`.
- Logs com rotacao em producao (`pino-roll`). Evidencia: `platform/logging/logger.ts`.
- Validacao de env no bootstrap do DB. Evidencia: `platform/db/env-validation.ts`.

Detalhes completos em `docs/standards/devops-deploy-guidelines.md`.

---

## Lessons Learned e Anti-padroes
Baseado em decisoes no codigo e auditorias internas.

### Padroes obrigatorios
- **Validacao server-side e obrigatoria** (nao confiar apenas na UI). Evidencia: `docs/architecture/api/api-contracts.md`.
- **Server e fonte da verdade de preco/quote** (seguranca F-01). Evidencias: `modules/cart/application/checkout.service.ts`, `app/api/shipments/create-paid/route.ts`.
- **Idempotencia em fluxos financeiros** (checkout/pagamentos). Evidencias: `platform/api/idempotency.ts`, `app/api/checkout/route.ts`.
- **Audit logs para acoes administrativas**. Evidencias: `platform/logging/audit-admin.ts`, `app/api/admin/staff/users/[id]/route.ts`.
- **Nao logar secrets/PII**: redaction e politicas. Evidencia: `platform/logging/logger.ts`.

### Padroes recomendados
- **EL components para UI** (evitar AntD direto). Evidencias: `shared/ui/index.ts`, `docs/el-components-migration-audit.md`.
- **Fail-close em seguranca** (tokens, idempotencia) e fail-open em cache. Evidencias: `platform/cache/cache.ts`, `platform/api/idempotency.ts`.

### Proibidos (anti-padroes)
- **Validacao apenas no client** (contraria padrao de API). Evidencia: `docs/architecture/api/api-contracts.md`.
- **Dependencia de status antigo** (enum legado em `shared/types/contracts.ts`). Evidencias: `shared/types/contracts.ts`, `modules/shipments/application/shipment-status.ts`.
- **Importar Prisma/DB em UI** (bloqueado pelo ESLint). Evidencia: `eslint.config.mjs`.

---

## Checklists (copiar/colar)

### Checklist por tipo de feature (tabela)

| Tipo | Checklist | Onde aplicar |
| --- | --- | --- |
| PR | PR Checklist | Em todo PR |
| Nova rota | Checklist "nova rota" | Nova API em `app/api/**/route.ts` |
| Nova tela | Checklist "nova tela" | UI em `app/(admin)`/`(envio)`/`(collector)` |
| Integracao externa | Checklist "integracao externa" | `platform/integrations/*` |
| Fluxo financeiro | Checklist "fluxo financeiro" | Wallet/checkout/pagamentos |
| Admin feature | Checklist "admin feature" | `app/(admin)` + `/api/admin/*` |

### PR Checklist
Baseado em: `platform/api/handler.ts`, `shared/validation/*`, `platform/auth/require-session.ts`, `platform/cache/rate-limit-redis.ts`, `platform/api/idempotency.ts`, `platform/logging/audit-admin.ts`, `shared/ui/index.ts`.
- [ ] Feature segue a area correta (`app/(admin)`/`(envio)`/`(collector)`/`(public)`).
- [ ] Zod schema aplicado no server (`shared/validation/*`).
- [ ] Handler usa `withApiHandler` ou `withApiHandlerResponse`.
- [ ] Sessao/RBAC corretos (`requireUserSession`, `requireAdminSession`).
- [ ] Rate limit aplicado quando necessario.
- [ ] Idempotencia aplicada em fluxos financeiros.
- [ ] Logs e auditoria em operacoes sensiveis.
- [ ] UI usa EL components; sem AntD direto (ou justificar).
- [ ] Testes minimos adicionados/atualizados.

### Checklist "nova rota"
Baseado em: `platform/api/handler.ts`, `platform/api/errors.ts`, `shared/validation/*`, `platform/auth/require-session.ts`.
- [ ] Definida em `app/api/**/route.ts`.
- [ ] Usa `withApiHandler` ou `withApiHandlerResponse`.
- [ ] Validacao Zod e erros `ApiError`.
- [ ] Autenticacao e autorizacao corretas.
- [ ] Rate limit (se mutacao/seguranca).
- [ ] Idempotencia se financeira.
- [ ] Logs com `logger` (requestId) e, se necessario, auditoria.

### Checklist "nova tela"
Baseado em: `shared/ui/index.ts`, `shared/ui/theme.ts`, `shared/ui/layout/dashboard-shell.tsx`.
- [ ] Layout correto (`DashboardShell` ou layout admin).
- [ ] Usa EL components e tokens (`shared/ui/*`, `app/globals.css`).
- [ ] Responsivo (breakpoints 768/1024). Evidencia: `shared/ui/layout/dashboard-shell.tsx`.
- [ ] Estado/queries via React Query/Zustand conforme padrao.
- [ ] Nao depende de dados sensiveis no client.

### Checklist "integracao externa"
Baseado em: `platform/integrations/*`, `platform/integrations/shared/circuit-breaker.ts`, `platform/logging/logger.ts`.
- [ ] Implementada em `platform/integrations/*`.
- [ ] Circuit breaker aplicado. Evidencia: `platform/integrations/shared/circuit-breaker.ts`.
- [ ] Timeouts configurados.
- [ ] Logs de integracao sem secrets.

### Checklist "fluxo financeiro"
Baseado em: `platform/api/idempotency.ts`, `modules/wallet/application/*`, `platform/cache/rate-limit-redis.ts`.
- [ ] Idempotencia aplicada.
- [ ] Verifica ownership e saldo.
- [ ] Ledger atualizado para auditoria.
- [ ] Rate limit por usuario.
- [ ] Logs e auditoria em admin.

### Checklist "admin feature"
Baseado em: `modules/admin/application/nav.ts`, `modules/auth/application/permissions.ts`, `platform/logging/audit-admin.ts`.
- [ ] Permissao declarada em `modules/admin/application/nav.ts`.
- [ ] Permissao validada no backend.
- [ ] Audit log em acoes sensiveis.
- [ ] Respeita rate limit para operacoes criticas.

---

## Apendices
- `docs/standards/architecture.md`
- `docs/standards/security.md`
- `docs/standards/api-guidelines.md`
- `docs/standards/frontend-guidelines.md`
- `docs/standards/backend-guidelines.md`
- `docs/standards/db-prisma-guidelines.md`
- `docs/standards/redis-cache-guidelines.md`
- `docs/standards/testing-guidelines.md`
- `docs/standards/devops-deploy-guidelines.md`
- `docs/standards/next-project-context.md`
