# Security Inventory (applied)

## Scope and method
- Scope: Next.js proxy, auth/session helpers, api handlers, rate limit, idempotency, webhooks, uploads, crypto, logging, and headers.
- Evidence sources include proxy and auth helpers, api wrappers, cache/rate-limit/idempotency modules, and security headers.
  Evidence: proxy.ts:1-777; modules/auth/application/route-protection.ts:1-229; platform/api/handler.ts:1-218; platform/cache/rate-limit-redis.ts:1-540; platform/api/idempotency.ts:1-200; next.config.ts:77-165

## Route protection and access control
### Proxy-based protection (default auth for /api)
- Implementation: getRouteProtection classifies routes as public/admin/auth/collector/pickup_point; any /api path not explicitly public falls back to auth (defense in depth).
- Where: modules/auth/application/route-protection.ts (PUBLIC_ROUTES, AUTH_API_ROUTES, COLLECTOR_API_ROUTES, PICKUP_POINT_API_ROUTES, default /api behavior).
- Default: fail-close for /api (requires auth if not explicitly public).
- Evidence: modules/auth/application/route-protection.ts:51-226

### Proxy enforcement + idle timeout
- Implementation: proxy.ts replaces middleware and enforces admin/user idle timeout using last_activity cookies; collectors/pickup points are explicitly exempt.
- Where: proxy.ts (idle rules, cookie names, timeout calculation, auth checks).
- Default: admin/user sessions expire on inactivity; collector/pickup point sessions only expire by JWT TTL.
- Evidence: proxy.ts:1-34, 64-74, 450-777

## Authentication and sessions
### Customer session (auth_token + refresh_token)
- Implementation: access+refresh JWTs, HttpOnly cookies, tokenVersion validation via Redis; refresh uses token rotation.
- Where: modules/auth/application/jwt-tokens.ts, modules/auth/application/session.ts, app/api/auth/refresh/route.ts, platform/auth/refresh-handler.ts, platform/cache/cache.ts.
- Default: tokenVersion validation is fail-close in production (Redis required), dev fallback allowed for tokenVersion init.
- Evidence: modules/auth/application/jwt-tokens.ts:3-189; modules/auth/application/session.ts:92-156; app/api/auth/refresh/route.ts:1-95; platform/auth/refresh-handler.ts:7-195; platform/cache/cache.ts:543-556

### Admin session (admin_auth)
- Implementation: admin JWT with AdminPermission list, tokenVersion check in Redis, HttpOnly cookie; idle timeout enforced by proxy + heartbeat endpoint updates last_activity.
- Where: modules/auth/application/admin-session.ts, platform/auth/require-session.ts, app/api/admin/auth/login/route.ts, app/api/admin/auth/heartbeat/route.ts, proxy.ts.
- Default: tokenVersion check is fail-close; idle timeout enabled by default for admin.
- Evidence: modules/auth/application/admin-session.ts:6-180; platform/auth/require-session.ts:67-106; app/api/admin/auth/login/route.ts:31-189; app/api/admin/auth/heartbeat/route.ts:22-112; proxy.ts:5-27, 516-523

### Pickup point session (collector_auth)
- Implementation: dedicated JWT secret, tokenVersion check in Redis, HttpOnly cookie; no idle timeout.
- Where: modules/auth/application/collector-session.ts, platform/auth/require-session.ts, app/api/pontos-coleta/auth/login/route.ts, proxy.ts.
- Default: tokenVersion check fail-close; idle timeout disabled by design.
- Evidence: modules/auth/application/collector-session.ts:4-170; platform/auth/require-session.ts:141-150; app/api/pontos-coleta/auth/login/route.ts:29-123; proxy.ts:5-27

### Autonomous collector session (coletor-token)
- Implementation: JWT cookie validated via jose, tokenVersion check in Redis, no idle timeout.
- Where: modules/auth/application/autonomous-collector-session.ts, app/api/coletores/auth/login/route.ts, proxy.ts.
- Default: tokenVersion check fail-close; idle timeout disabled by design.
- Evidence: modules/auth/application/autonomous-collector-session.ts:5-101; app/api/coletores/auth/login/route.ts:53-199; proxy.ts:5-27

## RBAC / permissions
- Implementation: AdminPermission enum in Prisma; requireAdminSession enforces permission list and super-admin bypass.
- Where: prisma/schema.prisma (AdminPermission), platform/auth/require-session.ts, app/api/admin/** routes.
- Default: fail-close (403 when permission missing).
- Evidence: prisma/schema.prisma:996-1006; platform/auth/require-session.ts:83-103; app/api/admin/finance/ledger/route.ts:1-17

## CSRF protection (Origin validation)
- Implementation: validate Origin vs Host, block Origin "null" or mismatched host; used in auth and refresh flows.
- Where: platform/api/csrf.ts and login/logout/refresh/heartbeat routes.
- Default: fail-close when Origin invalid (403).
- Evidence: platform/api/csrf.ts:1-90; app/api/auth/login/route.ts:22-29; app/api/admin/auth/login/route.ts:34-41; platform/auth/refresh-handler.ts:93-106

## Rate limiting
- Implementation: Redis-backed sliding window with local fallback; strict mode blocks when Redis unavailable.
- Where: platform/cache/rate-limit-redis.ts; used by auth and upload routes.
- Default: checkRateLimit is fail-open (local fallback); checkRateLimitStrict is fail-close in production (returns 503 / blocks).
- Evidence: platform/cache/rate-limit-redis.ts:5-186, 188-237, 404-458; app/api/auth/login/route.ts:26-29; app/api/admin/auth/login/route.ts:38-41; app/api/public/upload/collector-document/route.ts:108-115

## Idempotency
- Implementation: Redis-backed idempotency cache; dev fallback in memory; strict fail-close in production if Redis unavailable.
- Where: platform/api/idempotency.ts; used in checkout.
- Default: fail-close in production when Redis is down.
- Evidence: platform/api/idempotency.ts:1-137; app/api/checkout/route.ts:206-215

## Webhooks
- Implementation: HMAC-SHA256 signature validation using timingSafeEqual.
- Where: platform/api/webhook-auth.ts; tracking webhook validates signature in production when secret is configured.
- Default: in production, signature required when TRACKING_WEBHOOK_SECRET is set; otherwise no signature check.
- Evidence: platform/api/webhook-auth.ts:1-45; app/api/webhooks/tracking/route.ts:70-87

## Uploads and file handling
### Public collector document upload
- Implementation: strict rate limit, file size and MIME allowlist, magic-bytes validation, sanitized filenames.
- Where: app/api/public/upload/collector-document/route.ts.
- Default: fail-close (rate limit strict and magic bytes required).
- Evidence: app/api/public/upload/collector-document/route.ts:8-175

### File validation helpers (support, expenses, collector docs)
- Implementation: magic bytes validation, dangerous extension blocklist, extension allowlist.
- Where: platform/storage/file-validation.ts; used by storage helpers.
- Default: fail-close (validation must pass).
- Evidence: platform/storage/file-validation.ts:1-236; platform/storage/support-attachments.ts:46-55; platform/storage/expense-receipts.ts:46-54; platform/storage/collector-documents.ts:66-74

### Authenticated file serving
- Implementation: authenticated access, ownership checks for support files, path traversal protection, safe base path.
- Where: app/api/uploads/[...path]/route.ts.
- Default: fail-close (401/403 on missing auth or invalid path).
- Evidence: app/api/uploads/[...path]/route.ts:34-127

## Crypto / secrets
- Implementation: card PAN encryption with AES-256-GCM and key rotation; encryption for integration credentials using AES-256-GCM.
- Where: platform/crypto/card-vault.ts; platform/integrations/shared/encryption.service.ts.
- Default: card vault requires CARD_VAULT_KEY in production; integration encryption uses ENCRYPTION_KEY (falls back to random if not set).
- Evidence: platform/crypto/card-vault.ts:3-33; platform/integrations/shared/encryption.service.ts:1-16

## Logging and PII handling
- Implementation: structured logger with redact paths for tokens, secrets, and cookies.
- Where: platform/logging/logger.ts.
- Default: sensitive fields are redacted in all logs.
- Evidence: platform/logging/logger.ts:18-50

## Security headers and CORS
- Implementation: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy; CORS headers for /api.
- Where: next.config.ts.
- Default: applied to all routes; /api has explicit CORS allowlist.
- Evidence: next.config.ts:77-165

## Data isolation / ownership examples
- Customer scoping via userId on queries and services.
- Evidence: app/api/shipments/route.ts:13-26; modules/shipments/application/list.service.ts:123-167
- Ownership checks for support uploads.
- Evidence: app/api/uploads/[...path]/route.ts:70-98
