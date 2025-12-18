import Redis from 'ioredis';

// Configuracao do Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const REDIS_MAX_RETRIES = 3;
const REDIS_RETRY_DELAY = 100; // ms
const CIRCUIT_RESET_MS = 30000; // 30 segundos para resetar circuit breaker

// Use globalThis to persist state across hot reloads in development
// This prevents module-level state from being reset when Next.js recompiles
type RedisGlobalState = {
  redisClient: Redis | null;
  isConnected: boolean;
  connectionError: Error | null;
  connectionPromise: Promise<void> | null;
  circuitOpen: boolean;
  circuitOpenTime: number;
};

const globalForRedis = globalThis as typeof globalThis & {
  __redisState?: RedisGlobalState;
};

// Initialize global state if not exists
if (!globalForRedis.__redisState) {
  globalForRedis.__redisState = {
    redisClient: null,
    isConnected: false,
    connectionError: null,
    connectionPromise: null,
    circuitOpen: false,
    circuitOpenTime: 0,
  };
}

// Use references to global state
const state = globalForRedis.__redisState;

/**
 * Retorna o cliente Redis singleton
 * Cria uma nova conexao se nao existir
 */
export function getRedisClient(): Redis {
  if (!state.redisClient) {
    state.redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: REDIS_MAX_RETRIES,
      retryStrategy(times) {
        if (times > REDIS_MAX_RETRIES) {
          return null; // Para de tentar
        }
        return Math.min(times * REDIS_RETRY_DELAY, 2000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });

    // Criar promise que resolve quando conectar ou rejeita após timeout
    state.connectionPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Timeout de 2 segundos para conexão inicial
        if (!state.isConnected) {
          console.warn('[Redis] Timeout na conexão inicial');
        }
        resolve();
      }, 2000);

      state.redisClient!.once('ready', () => {
        clearTimeout(timeout);
        state.isConnected = true;
        state.connectionError = null;
        state.circuitOpen = false;
        if (process.env.NODE_ENV !== 'test') {
          console.log('[Redis] Conectado com sucesso');
        }
        resolve();
      });

      state.redisClient!.once('error', () => {
        clearTimeout(timeout);
        resolve(); // Resolve mesmo com erro para não bloquear
      });
    });

    state.redisClient.on('connect', () => {
      state.isConnected = true;
      state.connectionError = null;
      state.circuitOpen = false;
    });

    state.redisClient.on('error', (err) => {
      state.connectionError = err;
      state.isConnected = false;
      if (process.env.NODE_ENV !== 'test') {
        console.error('[Redis] Erro de conexao:', err.message);
      }
    });

    state.redisClient.on('close', () => {
      state.isConnected = false;
    });

    state.redisClient.on('reconnecting', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log('[Redis] Reconectando...');
      }
    });
  }

  return state.redisClient;
}

/**
 * Aguarda a conexão inicial do Redis (com timeout)
 * Use isso antes da primeira operação se precisar garantir que está conectado
 */
export async function waitForRedisConnection(): Promise<boolean> {
  getRedisClient(); // Garante que o cliente foi criado
  if (state.connectionPromise) {
    await state.connectionPromise;
  }
  return state.isConnected;
}

/**
 * Verifica se o Redis esta disponivel
 */
export function isRedisAvailable(): boolean {
  // Se circuit breaker esta aberto, verifica se deve resetar
  if (state.circuitOpen) {
    if (Date.now() - state.circuitOpenTime > CIRCUIT_RESET_MS) {
      state.circuitOpen = false;
    } else {
      return false;
    }
  }

  return state.isConnected && !state.connectionError;
}

/**
 * Abre o circuit breaker (chamado quando Redis falha)
 */
export function openCircuitBreaker(): void {
  state.circuitOpen = true;
  state.circuitOpenTime = Date.now();
}

/**
 * Executa comando Redis com tratamento de erro
 * Retorna null se Redis nao estiver disponivel (fail-open)
 */
export async function safeRedisCommand<T>(
  command: () => Promise<T>,
  fallback: T
): Promise<{ value: T; fromRedis: boolean }> {
  if (!isRedisAvailable()) {
    return { value: fallback, fromRedis: false };
  }

  try {
    const value = await command();
    return { value, fromRedis: true };
  } catch (error) {
    openCircuitBreaker();
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Redis] Comando falhou, usando fallback:', (error as Error).message);
    }
    return { value: fallback, fromRedis: false };
  }
}

/**
 * Fecha a conexao Redis (para testes e shutdown)
 */
export async function closeRedis(): Promise<void> {
  if (state.redisClient) {
    await state.redisClient.quit();
    state.redisClient = null;
    state.isConnected = false;
    state.connectionError = null;
  }
}

/**
 * Health check do Redis
 */
export async function redisHealthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}> {
  if (!isRedisAvailable()) {
    return {
      status: 'unhealthy',
      error: state.connectionError?.message || 'Redis nao conectado',
    };
  }

  try {
    const start = Date.now();
    await getRedisClient().ping();
    const latencyMs = Date.now() - start;

    return { status: 'healthy', latencyMs };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message,
    };
  }
}

// Re-export Redis types for convenience
export type { Redis };
