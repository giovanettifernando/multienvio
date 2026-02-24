# Inconsistencies (pattern applied only in parts of the code)

- INCONSISTENT: Node engine requires >=24, but CI workflow uses Node 20.
  Evidence: package.json:5-7; .github/workflows/forms-inventory.yml:15-19

- INCONSISTENT: Shipment status values diverge across shared contracts (lowercase), domain enum (UPPER_SNAKE with many states), and DB (String default PICKUP_REQUESTED).
  Evidence: shared/types/contracts.ts:14-21; modules/shipments/application/shipment-status.ts:9-119; prisma/schema.prisma:184-199

- INCONSISTENT: User status values differ between shared contracts (active/blocked) and DB default (pending), while login checks for ACTIVE.
  Evidence: shared/types/contracts.ts:65-68; prisma/schema.prisma:9-19; app/api/auth/login/route.ts:74-80

- INCONSISTENT: Pickup point status values differ between shared contracts (active/blocked) and DB enum (ACTIVE/BLOCKED/PENDING).
  Evidence: shared/types/contracts.ts:57-60; prisma/schema.prisma:1042-1046

- INCONSISTENT: Support status/priority values differ between shared contracts (ABERTO/EM_ATENDIMENTO/... and BAIXA/MEDIA/ALTA/CRITICA) and DB enums (OPEN/IN_PROGRESS/... and LOW/MEDIUM/HIGH/URGENT).
  Evidence: shared/types/contracts.ts:37-52; prisma/schema.prisma:1023-1035

- INCONSISTENT: Collection status values differ between shared contracts (aberta/agendada/...) and PickupRequest.status in DB (PENDING/SCHEDULED/COLLECTED/FAILED/CANCELED/COMPLETED).
  Evidence: shared/types/contracts.ts:26-32; prisma/schema.prisma:301-305

- INCONSISTENT: Admin status casing differs between app types (active/blocked) and DB enum (ACTIVE/BLOCKED).
  Evidence: modules/auth/application/types.ts:27-33; prisma/schema.prisma:991-994

- INCONSISTENT: Collector routes use plural namespace (/api/coletores/*) but there is a singular /api/coletor/reset-password; route protection patterns only include /api/coletores.
  Evidence: app/api/coletor/reset-password/route.ts:1-41; modules/auth/application/route-protection.ts:86-89, 221-226

- INCONSISTENT: Some API routes do not use withApiHandler/withApiHandlerResponse (e.g., admin heartbeat/refresh), while most do.
  Evidence: app/api/admin/auth/heartbeat/route.ts:22-121; app/api/admin/auth/refresh/route.ts:29-88; platform/api/handler.ts:28-218

- INCONSISTENT: Rate limiting strictness differs across auth flows (user/admin login use strict; collector and pickup-point login use non-strict).
  Evidence: app/api/auth/login/route.ts:26-29; app/api/admin/auth/login/route.ts:38-41; app/api/coletores/auth/login/route.ts:56-66; app/api/pontos-coleta/auth/login/route.ts:32-34

- INCONSISTENT: User auth helper usage differs (requireUser/requireUserSession vs getSession/getUserFromRequest) across user routes.
  Evidence: app/api/checkout/route.ts:144-146; app/api/shipments/route.ts:13-26; app/api/cart/checkout/route.ts:21-27; app/api/recipient-payment/list/route.ts:17-23; app/api/pickup-points/route.ts:18-27

- INCONSISTENT: Idempotency applied in /api/checkout but not in /api/cart/checkout-paid; /api/cart/checkout relies on internal idempotency without explicit key.
  Evidence: app/api/checkout/route.ts:206-215; app/api/cart/checkout-paid/route.ts:48-100; app/api/cart/checkout/route.ts:17-49

- INCONSISTENT: Pagination parsing is not centralized (parsePaginationParams exists but routes parse page/limit/offset manually).
  Evidence: platform/api/params.ts:44-66; app/api/shipments/route.ts:17-21; app/api/recipient-payment/list/route.ts:25-35

- INCONSISTENT: Redis key builder module says to use it, but call sites use raw key strings (example: pickup-points cache).
  Evidence: platform/cache/keys.ts:1-75; modules/pickup-points/application/list.service.ts:67-79

- INCONSISTENT: FAQ caching uses configCache while faqCache exists for invalidation only (two cache helpers for same domain).
  Evidence: platform/cache/cache.ts:1006-1019, 1186-1194; app/api/faq/route.ts:43-112; app/api/admin/config/faq/route.ts:16-121

- INCONSISTENT: Cache helpers exist for pickupPointsCache/agenciesCache/fipeCache/systemConfigCache but no call sites were found outside cache.ts during this review scan.
  Evidence: platform/cache/cache.ts:1205-1466; docs/standards-next-project/cache-usage-index.md:1-26

- INCONSISTENT: Empty API route groups exist (shipments-v2, recipients) without handlers.
  Evidence: docs/standards-next-project/repo-layout.md:36-39

- INCONSISTENT: Domain folder exists for shipments but has no files.
  Evidence: docs/standards-next-project/repo-layout.md:156-159
