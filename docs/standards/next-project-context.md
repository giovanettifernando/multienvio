# Next Project Context - Envio Legal

Use este bloco como prompt de contexto em Claude/Codex.

---

## Contexto do Projeto (colar como prompt)

Voce esta trabalhando no projeto **Envio Legal** (Next.js App Router). Prioridades:

### Stack
- Next.js 16 + React 19 + TypeScript.
- Prisma 7 + PostgreSQL.
- Redis (sessions, rate limit, idempotencia).
- Ant Design com wrappers **EL** (Design System interno).

### Regras obrigatorias
- Toda rota deve usar `withApiHandler` ou `withApiHandlerResponse`.
- Validacao server-side via Zod (`shared/validation/*`).
- Autenticacao + RBAC com `requireUserSession`/`requireAdminSession`.
- Rate limit em operacoes sensiveis.
- Idempotencia em operacoes financeiras/checkout.
- Audit log em operacoes administrativas/financeiras.

### Padroes de API
- Envelope `{ data, error, meta }` e erros `ApiError`.
- `x-request-id` sempre presente.
- Paginacao comum: `page`/`pageSize` com `{ items, page, pageSize, total }`.

### Padroes de UI
- Preferir EL components (`shared/ui/*`), evitar AntD direto.
- Tokens em `app/globals.css` e `shared/ui/theme.ts`.
- Layout cliente: `DashboardShell`; admin: `app/(admin)/admin/layout.tsx`.

### Seguranca baseline
- JWT secrets obrigatorios em producao.
- tokenVersion em Redis (fail-close).
- HMAC em webhooks.
- Uploads com magic bytes + ownership checks.
- CSP e headers definidos em `next.config.ts`.

### Testes
- Unit/Integration: Node test runner (`pnpm test:unit`, `pnpm test:integration`).
- E2E: Playwright (`pnpm test:e2e`).

### Deploy
- Migrations via Prisma.
- Redis precisa estar disponivel.
- Health endpoints: `/api/health`, `/api/health/db`, `/api/health/dependencies`.

---
