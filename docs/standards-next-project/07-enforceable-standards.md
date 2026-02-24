# Enforceable Standards (lint/CI candidates)

## Rule A: API routes must use withApiHandler/withApiHandlerResponse (or approved wrapper)
- Why: standardizes logging, requestId, error envelope, and correlation headers.
- Evidence of standard: platform/api/handler.ts:1-218; docs/standards-next-project/route-inventory.md:1-200
- How to detect:
  - ESLint custom rule: for files matching app/api/**/route.ts, ensure exported handlers are wrapped by withApiHandler or withApiHandlerResponse (allow-list createRefreshHandler as exception).
  - Grep check: flag any route.ts that exports GET/POST without withApiHandler or withApiHandlerResponse.
- Target files: app/api/**/route.ts

## Rule B: Mutating routes must validate payload with Zod (server-side)
- Why: server-side validation prevents UI bypass and keeps error shape consistent.
- Evidence of standard: app/api/checkout/route.ts:34-158; shared/validation/** (example schemas).
- How to detect:
  - ESLint rule: for POST/PUT/PATCH/DELETE handlers, require presence of zod.parse/safeParse or shared schema usage.
  - Grep check: find req.json() in route.ts and assert nearby z.object/parse usage.
- Target files: app/api/**/route.ts

## Rule C: Non-public routes must require session explicitly
- Why: defense in depth; do not rely only on proxy route protection.
- Evidence of standard: platform/auth/require-session.ts:36-151; app/api/shipments/route.ts:13-26; modules/auth/application/route-protection.ts:221-226
- How to detect:
  - ESLint rule: for app/api routes not listed in PUBLIC_ROUTES, require a call to requireUserSession/requireAdminSession/requirePickupPointSession/requireCollectorSession or getUserFromRequest with explicit denial.
  - Grep check: for app/api/**/route.ts, ensure at least one of require*Session/getUserFromRequest/getSession is called.
- Target files: app/api/**/route.ts

## Rule D: Critical mutations must include rate limit and idempotency
- Why: prevent brute force and duplicate financial operations.
- Evidence of standard: platform/cache/rate-limit-redis.ts:155-458; platform/api/idempotency.ts:1-137; app/api/checkout/route.ts:141-215
- How to detect:
  - ESLint rule: for paths with keywords (checkout, payments, wallet, login, reset-password), require enforceRateLimit* or rateLimitByIP* usage; for financial operations require withIdempotency or explicit idempotency key handling.
  - Grep check: ensure presence of enforceRateLimit/rateLimitByIP and withIdempotency in critical route handlers.
- Target files: app/api/**/route.ts

## Rule E: No direct AntD imports in Remetente scope (use EL* wrappers)
- Why: allows design system control and future library swap.
- Evidence of standard: docs/zero-antd-remetente.md:1-120; shared/ui/index.ts:1-56
- How to detect:
  - ESLint restricted-imports for antd in app/(envio), app/(auth), and shared/modules used by those routes.
  - Grep check: rg "from 'antd'" with allowlist exclusions (as documented in docs/zero-antd-remetente.md).
- Target files: app/(envio)/**, app/(auth)/**, modules/** (excluding admin/collector scopes), shared/** (excluding shared/ui)

## Rule F: Pagination must use parsePaginationParams
- Why: consistent query params and paging semantics across endpoints.
- Evidence of standard: platform/api/params.ts:1-66
- How to detect:
  - ESLint rule: for handlers that read page/pageSize/limit/offset, require parsePaginationParams usage.
  - Grep check: flag routes using searchParams.get('page') or 'offset' without parsePaginationParams.
- Target files: app/api/**/route.ts
