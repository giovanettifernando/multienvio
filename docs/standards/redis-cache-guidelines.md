# Redis/Cache Guidelines - Envio Legal

## 1) Cliente Redis
- Singleton com circuit breaker e conexao global. Evidencia: `platform/cache/redis.ts`.

## 2) Prefixos e keys
- Prefixo por ambiente (`prod`, `staging`, `dev`). Evidencia: `platform/cache/keys.ts`.
- Key builders (`Keys.session`, `Keys.idempotency`, etc.). Evidencia: `platform/cache/keys.ts`.

## 3) TTLs padrao
- TTLs centralizados (LONG/MEDIUM/SHORT/SESSION/STATIC/QUOTE). Evidencia: `platform/cache/cache.ts`.

## 4) Fail-open vs fail-close
- Cache de dados: fail-open. Evidencia: `platform/cache/cache.ts`.
- Seguranca (tokenVersion): fail-close em producao. Evidencia: `platform/cache/cache.ts`.
- Idempotencia: fail-close em producao. Evidencia: `platform/api/idempotency.ts`.

## 5) Sessoes
- `sessionCache`, `staffSessionCache`, `collectorSessionCache`, `pickupPointSessionCache`. Evidencia: `platform/cache/cache.ts`.

## 6) Rate limiting
- Rate limit distribuido com Redis + fallback local. Evidencia: `platform/cache/rate-limit-redis.ts`.

## 7) Recomendacoes praticas
- Novas chaves devem usar `platform/cache/keys.ts`.
- Operacoes criticas devem falhar se Redis indisponivel (prod).
