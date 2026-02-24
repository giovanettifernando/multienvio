# API Routes Inventory and Unification Notes

## Source of truth
- Full route list (grouped) is in docs/standards-next-project/route-inventory.md.
- Evidence: docs/standards-next-project/route-inventory.md:1-200

## Duplicate or overlapping route families
### Checkout flows (multiple endpoints)
- /api/checkout (processCheckout + idempotency + rate limit + requireUser).
- Evidence: app/api/checkout/route.ts:140-215

- /api/cart/checkout (processCartCheckout, getSession, no rate limit, no explicit idempotency header).
- Evidence: app/api/cart/checkout/route.ts:21-49

- /api/cart/checkout-paid (createCartShipmentsWithPayment, rate limit, requireUser).
- Evidence: app/api/cart/checkout-paid/route.ts:48-100

Unification idea:
- Consolidate to a single checkout domain service and expose one canonical endpoint with explicit idempotency and rate limit.
- Keep old endpoints as thin adapters (deprecated) until clients migrate.
- Evidence of current split: app/api/checkout/route.ts:6-13; app/api/cart/checkout/route.ts:4-5; app/api/cart/checkout-paid/route.ts:19-23

### Collector auth naming (singular vs plural)
- /api/coletores/* is the main collector namespace used for auth and operations.
- Evidence: app/api/coletores/auth/login/route.ts:1-22; app/api/coletores/coletas/route.ts (exists in route inventory)

- /api/coletor/reset-password exists as a singular namespace.
- Evidence: app/api/coletor/reset-password/route.ts:1-41

Unification idea:
- Standardize on /api/coletores/* and move /api/coletor/reset-password under /api/coletores/auth/* or /api/coletores/password/*.
- Update route protection to include the chosen namespace if needed.
- Evidence: modules/auth/application/route-protection.ts:86-89, 221-226

### Pickup points naming (PT vs EN)
- /api/pontos-coleta/* is the pickup point operator namespace (auth + dashboard).
- Evidence: app/api/pontos-coleta/auth/login/route.ts:1-33

- /api/pickup-points is a user-facing list endpoint (requires user auth).
- Evidence: app/api/pickup-points/route.ts:1-36

Unification idea:
- Document the split clearly (operator vs user list) or rename to avoid ambiguity (ex: /api/pickup-point-ops/* vs /api/pickup-points).
- Evidence: modules/auth/application/route-protection.ts:93-124

### Empty route groups (placeholders)
- app/api/shipments-v2 and app/api/recipients exist but contain no routes.
- Evidence: docs/standards-next-project/repo-layout.md:1-200; app/api/shipments-v2 (empty); app/api/recipients (empty)

Unification idea:
- Remove empty groups or populate with redirected/aliased handlers to avoid confusion.

## Incremental refactor plan (non-breaking)
1. Pick canonical namespaces for collectors and pickup points; update route-protection patterns and add 301/temporary wrappers for old routes.
2. Create a unified checkout service API (single input schema + idempotency + rate limiting) and make /api/cart/checkout and /api/cart/checkout-paid call it.
3. Add deprecation warnings in old endpoints and update clients to call the canonical route.
4. After migration, remove old routes and update route inventory docs.

## Entry points to review during unification
- Auth flows: app/api/auth/*, app/api/admin/auth/*, app/api/coletores/auth/*, app/api/pontos-coleta/auth/*.
- Checkout flows: app/api/checkout, app/api/cart/checkout, app/api/cart/checkout-paid.
- Collector reset: app/api/coletor/reset-password.
- Evidence: docs/standards-next-project/route-inventory.md:1-200
