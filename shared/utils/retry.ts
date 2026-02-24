/**
 * Utilitário de retry com backoff exponencial.
 *
 * Usado por handlers de PDF (Correios), workers e API routes
 * que precisam de resiliência contra falhas transientes.
 */

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  /** Se retornar false, para de tentar imediatamente */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback chamado antes de cada retry */
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
}

/** Preset de retry para chamadas à API dos Correios */
export const CORREIOS_RETRY_CONFIG: Omit<RetryOptions, 'shouldRetry' | 'onRetry'> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Executa uma função com retry e backoff exponencial.
 *
 * @example
 * const result = await withRetry(
 *   () => baixarRotuloPdf(prePostageId),
 *   { ...CORREIOS_RETRY_CONFIG, onRetry: (a, d) => log.warn(`retry ${a}`) }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  let delay = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= options.maxAttempts) break;

      if (options.shouldRetry && !options.shouldRetry(error, attempt)) {
        break;
      }

      if (options.onRetry) {
        options.onRetry(attempt, delay, error);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
    }
  }

  throw lastError;
}
