/**
 * Redis Key Builders com Namespace por Environment
 *
 * IMPORTANTE: Todas as chaves Redis devem ser criadas através deste módulo
 * para garantir:
 * - Namespace por environment (prod:, staging:, dev:)
 * - Consistência de prefixos
 * - Evitar colisões entre ambientes
 */

// Determina o prefixo de environment
function getEnvPrefix(): string {
  const env = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development'

  // Em Vercel, usar VERCEL_ENV para distinguir preview de production
  if (vercelEnv === 'production') return 'prod';
  if (vercelEnv === 'preview') return 'staging';

  // Fallback para NODE_ENV
  if (env === 'production') return 'prod';
  if (env === 'test') return 'test';

  return 'dev';
}

// Cache do prefixo para evitar recalcular
let cachedPrefix: string | null = null;

function getPrefix(): string {
  if (cachedPrefix === null) {
    cachedPrefix = getEnvPrefix();
  }
  return cachedPrefix;
}

/**
 * Tipos de chave suportados
 */
export type KeyType =
  | 'session'
  | 'staff_session'
  | 'collector_session'
  | 'pickup_point_session'
  | 'idempotency'
  | 'ratelimit'
  | 'wallet_balance'
  | 'cep'
  | 'quote'
  | 'config'
  | 'user'
  | 'collector'
  | 'shipment'
  | 'faq'
  | 'pickup_points'
  | 'agencies'
  | 'lock';

/**
 * Constrói uma chave Redis com namespace de environment
 *
 * @param type - Tipo de chave (session, idempotency, etc.)
 * @param parts - Partes adicionais da chave
 * @returns Chave formatada com prefixo de environment
 *
 * @example
 * buildKey('session', 'user123') // 'prod:session:user123'
 * buildKey('idempotency', 'checkout', 'abc123') // 'prod:idempotency:checkout:abc123'
 */
export function buildKey(type: KeyType, ...parts: (string | number)[]): string {
  const prefix = getPrefix();
  const partsStr = parts.map(String).join(':');
  return partsStr ? `${prefix}:${type}:${partsStr}` : `${prefix}:${type}`;
}

/**
 * Constrói um padrão de chave para SCAN/DELETE (com wildcard)
 *
 * @param type - Tipo de chave
 * @param parts - Partes adicionais (use '*' para wildcard)
 * @returns Padrão de chave para operações SCAN
 *
 * @example
 * buildPattern('session', '*') // 'prod:session:*'
 * buildPattern('quote', '01310100', '*') // 'prod:quote:01310100:*'
 */
export function buildPattern(type: KeyType, ...parts: (string | number)[]): string {
  return buildKey(type, ...parts);
}

// ============================================================================
// KEY BUILDERS ESPECÍFICOS (para retrocompatibilidade e type-safety)
// ============================================================================

export const Keys = {
  // Sessões
  session: (userId: string) => buildKey('session', userId),
  sessionTokenVersion: (userId: string) => buildKey('session', userId, 'tokenVersion'),

  staffSession: (staffId: string) => buildKey('staff_session', staffId),
  staffSessionTokenVersion: (staffId: string) => buildKey('staff_session', staffId, 'tokenVersion'),

  collectorSession: (collectorId: string) => buildKey('collector_session', collectorId),
  collectorSessionTokenVersion: (collectorId: string) => buildKey('collector_session', collectorId, 'tokenVersion'),

  pickupPointSession: (pointId: string) => buildKey('pickup_point_session', pointId),
  pickupPointSessionTokenVersion: (pointId: string) => buildKey('pickup_point_session', pointId, 'tokenVersion'),

  // Idempotência
  idempotency: (key: string) => buildKey('idempotency', key),

  // Rate Limiting
  rateLimit: (action: string, identifier: string) => buildKey('ratelimit', action, identifier),

  // Wallet
  walletBalance: (walletId: string) => buildKey('wallet_balance', walletId),

  // Cache de dados
  cep: (cep: string) => buildKey('cep', cep.replace(/\D/g, '')),
  config: (configKey: string) => buildKey('config', configKey),
  user: (userId: string) => buildKey('user', userId),
  collector: (collectorId: string) => buildKey('collector', collectorId),

  // Cache de cotações
  quote: (params: {
    originCep: string;
    destinationCep: string;
    weight: number;
    dimensions?: string;
    carrier?: string;
  }) => {
    const parts: (string | number)[] = [
      params.originCep.replace(/\D/g, ''),
      params.destinationCep.replace(/\D/g, ''),
      Math.round(params.weight * 100),
    ];
    if (params.dimensions) parts.push(params.dimensions);
    if (params.carrier) parts.push(params.carrier.toLowerCase());
    return buildKey('quote', ...parts);
  },

  // Lookups estáticos
  agencies: (cep5: string) => buildKey('agencies', cep5),

  // Locks (para stampede protection)
  lock: (key: string) => buildKey('lock', key),

  // Patterns para invalidação
  patterns: {
    allSessions: () => buildPattern('session', '*'),
    allStaffSessions: () => buildPattern('staff_session', '*'),
    allQuotesForCep: (cep: string) => buildPattern('quote', `*${cep.replace(/\D/g, '')}*`),
    allFaq: () => buildPattern('faq', '*'),
    allPickupPoints: () => buildPattern('pickup_points', '*'),
    pickupPointsByUf: (uf: string) => buildPattern('pickup_points', uf.toUpperCase(), '*'),
  },
} as const;

