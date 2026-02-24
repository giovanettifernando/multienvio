# Redis and Cache Inventory

## Redis client and availability
- Implementation: ioredis client, connection retry, circuit breaker, and availability checks.
- Where: platform/cache/redis.ts.
- Default: fail-open for non-critical cache (safeRedisCommand returns fallback); availability gate used by higher-level caches.
- Evidence: platform/cache/redis.ts:3-172

## Key namespace and TTL policy
- Environment prefixing via prefixKey (prod/dev/test/staging) and CachePrefix constants.
- Where: platform/cache/cache.ts and platform/cache/keys.ts.
- Evidence: platform/cache/cache.ts:43-82; platform/cache/keys.ts:11-178

- TTL policy (seconds): LONG=3600, MEDIUM=300, SHORT=60, SESSION=900, STATIC=604800, QUOTE=3600.
- Evidence: platform/cache/cache.ts:22-41

## Session caches (security-critical)
- User sessionCache with tokenVersion and 7-day TTL; tokenVersion is fail-close in production.
- Evidence: platform/cache/cache.ts:471-621

- Admin staffSessionCache, collectorSessionCache, pickupPointSessionCache with tokenVersion and fail-close in production.
- Evidence: platform/cache/cache.ts:628-988

## Data caches (domain)
- userCache for user profile data; used in auth/me and logout flows.
- Evidence: platform/cache/cache.ts:455-468; app/api/auth/me/route.ts:17-76; app/api/auth/logout/route.ts:5-67

- configCache used to cache public FAQ responses (1 hour).
- Evidence: platform/cache/cache.ts:1006-1019; app/api/faq/route.ts:43-112

- cepCache used by Correios CEP lookup (7 days TTL).
- Evidence: platform/cache/cache.ts:1089-1106; platform/integrations/correios/cep.ts:233-282

- quoteCache used by Correios price/time quotes (1 hour TTL).
- Evidence: platform/cache/cache.ts:1113-1170; platform/integrations/correios/precoPrazo.ts:482-605

- shipmentsCache (SWR) used for user shipments list.
- Evidence: platform/cache/cache.ts:1310-1344; modules/shipments/application/list.service.ts:86-106

- ticketsCache (SWR) used for admin support ticket list.
- Evidence: platform/cache/cache.ts:1365-1399; modules/support/application/service.ts:341-357

- kpisCache (SWR) used for admin ops KPIs.
- Evidence: platform/cache/cache.ts:1412-1429; app/api/admin/ops/kpis/route.ts:74-80

- Wallet balance cache uses cacheGet/cacheSet directly with "wallet:balance:" prefix.
- Evidence: modules/wallet/application/ledger-balance.service.ts:32-163

- Pickup points list cache uses cacheGetOrSet directly with "pickup-points:" prefix.
- Evidence: modules/pickup-points/application/list.service.ts:67-79

## Rate limit and idempotency keys
- Rate limit uses "ratelimit:{key}" ZSET entries (sliding window).
- Evidence: platform/cache/rate-limit-redis.ts:88-141

- Idempotency keys use prefixKey("idempotency:{key}") and Redis SET NX PX.
- Evidence: platform/api/idempotency.ts:58-115

## Non-Redis caches (in-memory)
- MercadoPago config is cached in memory for 5 minutes.
- Evidence: platform/integrations/mercadopago/config.ts:39-112

- OpenRouter config is cached in memory for 1 minute.
- Evidence: platform/integrations/openrouter/config.service.ts:12-48

## Simplification opportunities (observed)
- Public FAQ caching uses configCache while faqCache exists only for invalidation; consider consolidating cache helper usage for clarity.
- Evidence: platform/cache/cache.ts:1186-1194; app/api/faq/route.ts:43-112; app/api/admin/config/faq/route.ts:16-121

- Pickup points list uses manual "pickup-points:" key while pickupPointsCache helper exists; consider routing through the helper for consistent invalidation.
- Evidence: platform/cache/cache.ts:1205-1219; modules/pickup-points/application/list.service.ts:67-79

## Cache candidates (no cache helpers observed)
- Admin ops shipments list performs count + findMany with multiple includes and no cache helper; candidate for SWR or short TTL cache if UI calls frequently.
- Evidence: app/api/admin/ops/shipments/route.ts:54-95

- Admin ops pickups list performs findMany + count + groupBy with includes and no cache helper; candidate for SWR or short TTL cache if UI calls frequently.
- Evidence: app/api/admin/ops/pickups/route.ts:136-190
