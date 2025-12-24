RELATÓRIO DE AUDITORIA — REDIS + CACHE STRATEGY

  ---
  1️⃣ TABELA — INVENTÁRIO REDIS ATUAL

  | Local                                                | Tipo de Uso      | Key Pattern                        | TTL            | Fallback                         | Riscos     | Observações                          |
  |------------------------------------------------------|------------------|------------------------------------|----------------|----------------------------------|------------|--------------------------------------|
  | platform/cache/cache.ts:sessionCache                 | Auth/Session     | session:{userId}                   | 7 dias         | ⚠️ Retorna null, login requerido | Médio      | tokenVersion em chave separada       |
  | platform/cache/cache.ts:sessionCache                 | Token Version    | session:{userId}:tokenVersion      | 7 dias         | Retorna 1                        | ⚠️ RISCO   | Fail-open em tokenVersion é perigoso |
  | platform/cache/cache.ts:staffSessionCache            | Admin Auth       | staff_session:{staffId}            | 7 dias         | Retorna null                     | Médio      | Mesmo padrão do user                 |
  | platform/cache/cache.ts:collectorSessionCache        | Coletor Auth     | collector_session:{id}             | 7 dias         | Retorna null                     | Médio      | Mesmo padrão                         |
  | platform/cache/cache.ts:pickupPointSessionCache      | PickupPoint Auth | pickup_point_session:{id}          | 7 dias         | Retorna null                     | Médio      | Mesmo padrão                         |
  | platform/cache/rate-limit-redis.ts                   | Rate Limit       | ratelimit:{action}:{ip/user}       | Sliding window | ✅ Fallback local                | Baixo      | Lua script atômico                   |
  | modules/wallet/application/ledger-balance.service.ts | Cache Saldo      | wallet:balance:{walletId}          | 60s            | ✅ Calcula do ledger             | Baixo      | Invalidação explícita                |
  | platform/cache/cache.ts:cepCache                     | Cache CEP        | cep:{cep}                          | 7 dias         | ✅ Busca API                     | Baixo      | Dado estático                        |
  | platform/cache/cache.ts:quoteCache                   | Cache Cotação    | quote:{origin}:{dest}:{weight}:... | 1 hora         | ✅ Busca API                     | Baixo      | Preços podem mudar                   |
  | platform/cache/cache.ts:configCache                  | Configs          | config:{key}                       | 1 hora         | ✅ Busca DB                      | Baixo      | Pouco usado                          |
  | platform/api/idempotency.ts                          | Idempotência     | idempotency:{key}                  | 5 min          | ⚠️ Map em memória                | 🔴 CRÍTICO | Redis não implementado!              |

  Mapa de Chaves (Prefixos)

  session:*              → Per-user (cliente)
  staff_session:*        → Per-admin
  collector_session:*    → Per-coletor
  pickup_point_session:* → Per-ponto
  ratelimit:*            → Per-action + IP/user
  wallet:balance:*       → Per-wallet
  cep:*                  → Global (por CEP)
  quote:*                → Global (por params)
  config:*               → Global
  idempotency:*          → ⚠️ NÃO USA REDIS (apenas memória)

  ---
  2️⃣ AUDITORIA DE CORREÇÃO (CHECKLIST)

  ✅ Rate Limit

  | Verificação               | Status     | Evidência                                                |
  |---------------------------|------------|----------------------------------------------------------|
  | Redis em rotas sensíveis? | ✅         | Login, checkout, reset-password usam rateLimitByIPStrict |
  | Bypass possível?          | ⚠️ Parcial | Fallback local em checkRateLimit (não strict)            |
  | Fail-close em produção?   | ✅         | checkRateLimitStrict bloqueia se Redis down              |

  ⚠️ Auth/Session

  | Verificação             | Status                | Evidência                                             |
  |-------------------------|-----------------------|-------------------------------------------------------|
  | Cache miss = ?          | ⚠️ Fail-open perigoso | getOrInitTokenVersion retorna 1 se Redis down         |
  | tokenVersion validado?  | ✅                    | Validado em refresh (platform/cache/cache.ts:257-269) |
  | Logout invalida sessão? | ✅                    | incrementTokenVersion invalida todos os tokens        |

  🔴 RISCO CRÍTICO: Se Redis estiver down, getOrInitTokenVersion retorna 1, permitindo que tokens antigos sejam válidos. Isso é fail-open em auth — deveria ser fail-close.

  🔴 Idempotência

  | Verificação                 | Status     | Evidência                                                     |
  |-----------------------------|------------|---------------------------------------------------------------|
  | Checkout usa idempotência?  | ✅         | withIdempotency em checkout/route.ts:211-215                  |
  | Redis implementado?         | ❌ NÃO     | platform/api/idempotency.ts:51-58 — código comentado com TODO |
  | Webhooks usam idempotência? | ⚠️ Parcial | MP webhook usa prisma.findFirst no DB, não Redis              |

  🔴 RISCO CRÍTICO: Idempotência está em memória local (Map). Em ambiente com múltiplas instâncias, checkouts podem ser processados duplicados!

  ⚠️ Locks (Operações Financeiras)

  | Verificação               | Status      | Evidência                                     |
  |---------------------------|-------------|-----------------------------------------------|
  | Débito usa lock?          | ✅ Postgres | wallet.service.ts:176-181 usa FOR UPDATE      |
  | Lock distribuído (Redis)? | ❌          | Não existe SET NX para locks                  |
  | Double spend possível?    | ⚠️ Baixo    | Postgres lock funciona, mas não é distribuído |

  ⚠️ Dashboards/Admin

  | Verificação          | Status | Evidência                                               |
  |----------------------|--------|---------------------------------------------------------|
  | Cache em listagens?  | ❌     | listUserShipments, listTicketsForAdmin vão direto ao DB |
  | Cache em agregações? | ❌     | Nenhum cache em contagens/KPIs                          |

  ✅ Keys/Namespace

  | Verificação           | Status   | Evidência                          |
  |-----------------------|----------|------------------------------------|
  | Namespace por env?    | ❌       | Keys não incluem env (prod:, dev:) |
  | Namespace por tenant? | ✅       | Keys incluem userId/walletId       |
  | Colisão possível?     | ⚠️ Baixo | Entre envs se compartilharem Redis |

  ⚠️ TTL/Stampede

  | Verificação             | Status | Evidência                               |
  |-------------------------|--------|-----------------------------------------|
  | TTLs coerentes?         | ✅     | Session=7d, Balance=60s, Quote=1h       |
  | Proteção stampede?      | ❌     | cacheGetOrSet não tem lock/singleflight |
  | Stale-while-revalidate? | ❌     | Não implementado                        |

  ---
  3️⃣ TABELA — GAPS E OPORTUNIDADES

  | Endpoint/Service             | Query/Operação                   | Sugestão                   | Key                                            | TTL    | Invalidação               | Risco           | Prioridade |
  |------------------------------|----------------------------------|----------------------------|------------------------------------------------|--------|---------------------------|-----------------|------------|
  | listUserShipments            | Query paginada por user          | Cache por user+status+page | shipments:user:{id}:v{version}:{status}:{page} | 60s    | Invalida em create/update | Stale OK        | 🟡 Média   |
  | listTicketsForAdmin          | Lista tickets admin              | Cache global por filtros   | tickets:admin:{filters_hash}                   | 30s    | Invalida em update        | Stale OK        | 🟡 Média   |
  | correiosAgencies (nearby)    | Busca agências por CEP           | Cache por CEP              | agencies:{cep}                                 | 7 dias | TTL-only                  | Nenhum          | 🟢 Alta    |
  | fipeVehicles                 | Listagem veículos FIPE           | Cache global               | fipe:brands / fipe:models:{brandId}            | 7 dias | TTL-only                  | Nenhum          | 🟢 Alta    |
  | Admin Dashboard KPIs         | Agregações (contagem por status) | Cache agregado             | dashboard:kpis:v{day}                          | 5 min  | TTL-only                  | Stale aceitável | 🟡 Média   |
  | EmailConfig/OpenRouterConfig | Configs do sistema               | Cache config               | config:email / config:openrouter               | 1 hora | Bust on update            | Baixo           | 🟢 Alta    |
  | carrier-credentials          | Credenciais transportadoras      | Cache seguro               | carrier:creds:{id}                             | 5 min  | Bust on update            | Baixo           | 🟢 Alta    |
  | platform-commissions         | Tabela de comissões              | Cache global               | config:commissions                             | 1 hora | Bust on update            | Baixo           | 🟢 Alta    |

  ---
  4️⃣ ANÁLISE DE PADRONIZAÇÃO

  ✅ O Que Está Bem Feito

  1. Cliente Redis Singleton — platform/cache/redis.ts:45-112
    - Hot reload safe com globalThis
    - Circuit breaker implementado
    - Retry strategy configurado
  2. Cache Wrappers — platform/cache/cache.ts
    - cacheGet/cacheSet/cacheDelete padronizados
    - cacheGetOrSet implementa cache-aside
    - TTLs definidos em constantes
  3. Rate Limit Robusto — platform/cache/rate-limit-redis.ts
    - Sliding window com Lua script atômico
    - Fallback local
    - checkRateLimitStrict para rotas sensíveis

  ⚠️ O Que Precisa Melhorar

  1. Idempotência NÃO usa Redis — platform/api/idempotency.ts
    - TODO comentado nunca foi implementado
    - Risco de checkouts duplicados em multi-instance
  2. Sem Proteção de Stampede — cacheGetOrSet
    - N requisições simultâneas = N queries ao DB
    - Falta singleflight/lock curto
  3. Sem Stale-While-Revalidate
    - Cache expira = todas as requests esperam recompute
    - Poderia servir stale enquanto atualiza em background
  4. Sem Namespace por Environment
    - Keys não distinguem prod/dev/staging
    - Risco de colisão se compartilharem Redis
  5. Sem Metrics de Hit/Miss
    - getCacheStats existe mas cacheGetWithStats não é usado
    - Falta observabilidade real (Prometheus/Datadog)

  ---
  5️⃣ PROBLEMAS CRÍTICOS (AÇÃO IMEDIATA)

  🔴 #1: Idempotência em Memória (CRÍTICO)

  Problema: platform/api/idempotency.ts usa Map local, não Redis.

  Impacto: Em ambiente com múltiplas instâncias, checkouts duplicados podem ocorrer.

  Evidência:
  // TODO: Quando Redis estiver disponível, usar Redis ao invés de memória
  // const redis = getRedisClient();
  // ...
  const cached = memoryCache.get(prefixedKey);  // ← USA MAP LOCAL!

  Correção:
  import { getRedisClient, isRedisAvailable } from '@/platform/cache/redis';

  export async function checkIdempotency<T>(key: string): Promise<...> {
    if (isRedisAvailable()) {
      const redis = getRedisClient();
      const cached = await redis.get(`idempotency:${key}`);
      if (cached) return { cached: true, result: JSON.parse(cached), key };
    }
    // Fallback para memória apenas em dev
    ...
  }

  ---
  🔴 #2: tokenVersion Fail-Open (ALTO RISCO)

  Problema: getOrInitTokenVersion retorna 1 se Redis down.

  Impacto: Usuários podem usar tokens antigos se Redis falhar.

  Evidência:
  async getOrInitTokenVersion(userId: string): Promise<number> {
    if (!isRedisAvailable()) {
      return 1;  // ← FAIL-OPEN! Permite tokens antigos
    }
    ...
  }

  Correção: Em produção, deve ser fail-close (rejeitar requests se Redis down) ou usar banco como fallback.

  ---
  6️⃣ PLANO EM FASES (PRs Pequenos)

  PR1: Padronização + Namespace + Metrics

  Arquivos:
  - platform/cache/keys.ts (NOVO)
  - platform/cache/cache.ts (atualizar)
  - platform/cache/metrics.ts (NOVO)

  Mudanças:
  1. Criar key builders com namespace por env:
     buildKey('session', userId) → 'prod:session:{userId}'

  2. Adicionar metrics em cacheGet/cacheSet:
     - cache_hits_total{type="session"}
     - cache_misses_total{type="session"}
     - cache_latency_seconds{operation="get"}

  Testes:
  - Unit tests para key builders
  - Verificar metrics exportadas

  PR2: Implementar Idempotência no Redis (CRÍTICO)

  Arquivos:
  - platform/api/idempotency.ts

  Mudanças:
  1. Remover TODO e implementar Redis
  2. Usar SET NX com TTL para garantir atomicidade
  3. Em produção: fail-close se Redis down
  4. Em dev: fallback para Map

  Pseudo-código:
  async function checkIdempotency(key) {
    const redis = getRedisClient();
    const result = await redis.get(`idempotency:${key}`);
    if (result) return { cached: true, result: JSON.parse(result) };
    return { cached: false };
  }

  async function saveIdempotencyResult(key, result, ttlMs) {
    const redis = getRedisClient();
    await redis.set(`idempotency:${key}`, JSON.stringify(result), 'PX', ttlMs, 'NX');
  }

  Testes:
  - Test duplo checkout com mesma key
  - Test cleanup após TTL
  - Test concorrência

  PR3: Cache Seguro (Configs/Lookups)

  Endpoints:
  - correiosAgencies/nearby
  - fipeVehicles
  - platformCommissions
  - emailConfig
  - openRouterConfig

  Key design:
  - agencies:nearby:{cep5} → TTL 7d
  - fipe:brands → TTL 7d
  - config:{type} → TTL 1h, bust on update

  Invalidação:
  - Event-based: após admin update, chamar cacheDelete

  Testes:
  - Verificar cache hit em segunda chamada
  - Verificar invalidação após update

  PR4: Cache Derivado + Stampede Protection

  Arquivos:
  - platform/cache/cache.ts (adicionar cacheGetOrSetWithLock)

  Mudanças:
  1. Adicionar singleflight/lock curto:
     async function cacheGetOrSetWithLock<T>(key, fetchFn, ttl) {
       const cached = await cacheGet(key);
       if (cached) return cached;

       // Tentar adquirir lock
       const lockKey = `lock:${key}`;
       const acquired = await redis.set(lockKey, '1', 'NX', 'PX', 5000);

       if (!acquired) {
         // Outro processo está recomputando, esperar um pouco e tentar cache
         await sleep(100);
         return cacheGet(key) ?? fetchFn(); // fallback
       }

       try {
         const value = await fetchFn();
         await cacheSet(key, value, ttl);
         return value;
       } finally {
         await redis.del(lockKey);
       }
     }

  2. Aplicar em:
     - listUserShipments (cache por user+page)
     - dashboard KPIs
     - wallet balance (já tem)

  Testes:
  - Test stampede com 100 requests simultâneas
  - Verificar apenas 1 query ao DB

  PR5: Stale-While-Revalidate (Opcional)

  Implementar padrão SWR:
  - Servir valor stale imediatamente
  - Revalidar em background
  - Atualizar cache silenciosamente

  Útil para:
  - Dashboard KPIs
  - Listagens admin
  - Agregações

  ---
  7️⃣ RESUMO EXECUTIVO

  🔴 Ação Imediata (Esta Semana)

  1. Implementar idempotência no Redis — Risco de checkouts duplicados
  2. Revisar fail-open em tokenVersion — Risco de bypass de logout

  🟡 Próximas Sprints

  3. Adicionar namespace por env nas keys
  4. Implementar stampede protection
  5. Cache em configs e lookups estáticos

  🟢 Boas Práticas Já Implementadas

  - Rate limit robusto com Lua script
  - Cache de saldo com invalidação explícita
  - Circuit breaker no cliente Redis
  - TTLs coerentes por tipo de dado

  Métricas de Impacto Esperado

  | Mudança                 | Impacto DB    | Latência | Risco                   |
  |-------------------------|---------------|----------|-------------------------|
  | Cache correiosAgencies  | -90% queries  | -200ms   | Nenhum                  |
  | Cache listUserShipments | -70% queries  | -100ms   | Stale 60s               |
  | Stampede protection     | -80% picos    | Estável  | Nenhum                  |
  | Idempotência Redis      | 0 (segurança) | 0        | 🔴 Crítico se não feito |

  ---

● CONCLUSÃO

  A arquitetura de Redis está bem estruturada com wrappers padronizados, rate limiting robusto e cache de saldo correto. Porém, existem dois problemas críticos que precisam de ação imediata:

  🔴 Prioridade Máxima

  1. Idempotência não usa Redis (platform/api/idempotency.ts:51-58)
    - Código marcado com TODO mas nunca implementado
    - Em produção multi-instance, checkouts podem duplicar
    - Correção: Implementar Redis com SET NX PX
  2. tokenVersion fail-open (platform/cache/cache.ts:276-278)
    - Se Redis down, retorna 1 — permite tokens antigos
    - Correção: Fail-close em produção ou fallback para DB

  ✅ O Que Já Funciona Bem

  - Rate limit com Lua script atômico + fallback local
  - Cache de saldo com invalidação explícita pós-transação
  - Session cache com tokenVersion para logout distribuído
  - Circuit breaker no cliente Redis

  Próximos Passos Recomendados

  1. PR1: Implementar idempotência no Redis (URGENTE)
  2. PR2: Adicionar namespace por env nas keys
  3. PR3: Cache em lookups estáticos (agências, FIPE, configs)
  4. PR4: Stampede protection com singleflight

