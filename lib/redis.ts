import Redis from 'ioredis';

// Configuracao do Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const REDIS_MAX_RETRIES = 3;
const REDIS_RETRY_DELAY = 100; // ms

// Singleton do cliente Redis
let redisClient: Redis | null = null;
let isConnected = false;
let connectionError: Error | null = null;
let connectionPromise: Promise<void> | null = null;

// Circuit breaker state
let circuitOpen = false;
let circuitOpenTime = 0;
const CIRCUIT_RESET_MS = 30000; // 30 segundos para resetar circuit breaker

/**
 * Retorna o cliente Redis singleton
 * Cria uma nova conexao se nao existir
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
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
    connectionPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Timeout de 2 segundos para conexão inicial
        if (!isConnected) {
          console.warn('[Redis] Timeout na conexão inicial');
        }
        resolve();
      }, 2000);

      redisClient!.once('ready', () => {
        clearTimeout(timeout);
        isConnected = true;
        connectionError = null;
        circuitOpen = false;
        if (process.env.NODE_ENV !== 'test') {
          console.log('[Redis] Conectado com sucesso');
        }
        resolve();
      });

      redisClient!.once('error', () => {
        clearTimeout(timeout);
        resolve(); // Resolve mesmo com erro para não bloquear
      });
    });

    redisClient.on('connect', () => {
      isConnected = true;
      connectionError = null;
      circuitOpen = false;
    });

    redisClient.on('error', (err) => {
      connectionError = err;
      isConnected = false;
      if (process.env.NODE_ENV !== 'test') {
        console.error('[Redis] Erro de conexao:', err.message);
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log('[Redis] Reconectando...');
      }
    });
  }

  return redisClient;
}

/**
 * Aguarda a conexão inicial do Redis (com timeout)
 * Use isso antes da primeira operação se precisar garantir que está conectado
 */
export async function waitForRedisConnection(): Promise<boolean> {
  getRedisClient(); // Garante que o cliente foi criado
  if (connectionPromise) {
    await connectionPromise;
  }
  return isConnected;
}

/**
 * Verifica se o Redis esta disponivel
 */
export function isRedisAvailable(): boolean {
  // Se circuit breaker esta aberto, verifica se deve resetar
  if (circuitOpen) {
    if (Date.now() - circuitOpenTime > CIRCUIT_RESET_MS) {
      circuitOpen = false;
    } else {
      return false;
    }
  }

  return isConnected && !connectionError;
}

/**
 * Abre o circuit breaker (chamado quando Redis falha)
 */
export function openCircuitBreaker(): void {
  circuitOpen = true;
  circuitOpenTime = Date.now();
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
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    connectionError = null;
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
      error: connectionError?.message || 'Redis nao conectado',
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
