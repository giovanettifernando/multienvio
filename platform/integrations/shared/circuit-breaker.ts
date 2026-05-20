/**
 * Circuit Breaker para proteção de integrações externas
 *
 * Implementa o padrão Circuit Breaker para evitar chamadas excessivas
 * a serviços externos que estão falhando, permitindo recuperação gradual.
 *
 * Estados:
 * - CLOSED: Circuito fechado, requisições passam normalmente
 * - OPEN: Circuito aberto, requisições são rejeitadas imediatamente
 * - HALF_OPEN: Testando se o serviço se recuperou
 */

import { logger } from '@/platform/logging/logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Nome do circuito (para logging) */
  name: string;
  /** Número de falhas para abrir o circuito */
  failureThreshold: number;
  /** Tempo em ms que o circuito fica aberto antes de testar novamente */
  resetTimeoutMs: number;
  /** Número de sucessos necessários no HALF_OPEN para fechar o circuito */
  successThreshold: number;
  /** Timeout para considerar uma chamada como falha */
  callTimeoutMs?: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastStateChange: number;
}

// Armazenamento de estados dos circuit breakers
const circuitStates = new Map<string, CircuitBreakerState>();

/**
 * Obtém ou cria o estado de um circuit breaker
 */
function getCircuitState(name: string): CircuitBreakerState {
  if (!circuitStates.has(name)) {
    circuitStates.set(name, {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastStateChange: Date.now(),
    });
  }
  return circuitStates.get(name)!;
}

/**
 * Classe principal do Circuit Breaker
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    // Defaults + config overrides
    this.config = {
      ...config,
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 30000, // 30 segundos
      successThreshold: config.successThreshold ?? 2,
      callTimeoutMs: config.callTimeoutMs ?? 30000,
    };
  }

  /**
   * Verifica se o circuito permite uma chamada
   */
  private canCall(): boolean {
    const state = getCircuitState(this.config.name);

    switch (state.state) {
      case 'CLOSED':
        return true;

      case 'OPEN': {
        // Verificar se é hora de testar novamente
        const now = Date.now();
        const timeSinceOpen = now - state.lastStateChange;

        if (timeSinceOpen >= this.config.resetTimeoutMs) {
          // Transição para HALF_OPEN
          state.state = 'HALF_OPEN';
          state.successCount = 0;
          state.lastStateChange = now;

          logger.info({
            event: 'circuit_breaker_half_open',
            name: this.config.name,
          }, `Circuit breaker ${this.config.name}: OPEN -> HALF_OPEN`);

          return true;
        }

        return false;
      }

      case 'HALF_OPEN':
        // Permitir apenas uma chamada por vez no HALF_OPEN
        return true;

      default:
        return false;
    }
  }

  /**
   * Registra uma falha
   */
  private recordFailure(error: Error): void {
    const state = getCircuitState(this.config.name);
    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.state === 'HALF_OPEN') {
      // Falha em HALF_OPEN abre o circuito novamente
      state.state = 'OPEN';
      state.lastStateChange = Date.now();

      logger.warn({
        event: 'circuit_breaker_reopened',
        name: this.config.name,
        error: error.message,
      }, `Circuit breaker ${this.config.name}: HALF_OPEN -> OPEN (falha durante teste)`);
    } else if (state.state === 'CLOSED' && state.failureCount >= this.config.failureThreshold) {
      // Atingiu threshold de falhas, abre o circuito
      state.state = 'OPEN';
      state.lastStateChange = Date.now();

      logger.error({
        event: 'circuit_breaker_opened',
        name: this.config.name,
        failureCount: state.failureCount,
        error: error.message,
      }, `Circuit breaker ${this.config.name}: CLOSED -> OPEN (threshold atingido)`);
    }
  }

  /**
   * Registra um sucesso
   */
  private recordSuccess(): void {
    const state = getCircuitState(this.config.name);

    if (state.state === 'HALF_OPEN') {
      state.successCount++;

      if (state.successCount >= this.config.successThreshold) {
        // Sucesso suficiente, fecha o circuito
        state.state = 'CLOSED';
        state.failureCount = 0;
        state.successCount = 0;
        state.lastStateChange = Date.now();

        logger.info({
          event: 'circuit_breaker_closed',
          name: this.config.name,
        }, `Circuit breaker ${this.config.name}: HALF_OPEN -> CLOSED (recuperado)`);
      }
    } else if (state.state === 'CLOSED') {
      // Reset do contador de falhas após sucesso
      state.failureCount = 0;
    }
  }

  /**
   * Executa uma operação protegida pelo circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canCall()) {
      const state = getCircuitState(this.config.name);

      logger.warn({
        event: 'circuit_breaker_rejected',
        name: this.config.name,
        state: state.state,
      }, `Circuit breaker ${this.config.name}: requisição rejeitada (circuito aberto)`);

      throw new CircuitBreakerError(
        `Serviço ${this.config.name} temporariamente indisponível`,
        this.config.name
      );
    }

    try {
      // Executar operação com timeout
      const result = await this.executeWithTimeout(operation);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Executa operação com timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    const timeoutMs = this.config.callTimeoutMs || 30000;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout após ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  /**
   * Retorna o estado atual do circuito
   */
  getState(): CircuitState {
    return getCircuitState(this.config.name).state;
  }

  /**
   * Força o reset do circuito (útil para testes ou recuperação manual)
   */
  reset(): void {
    const state = getCircuitState(this.config.name);
    state.state = 'CLOSED';
    state.failureCount = 0;
    state.successCount = 0;
    state.lastStateChange = Date.now();

    logger.info({
      event: 'circuit_breaker_reset',
      name: this.config.name,
    }, `Circuit breaker ${this.config.name}: reset manual`);
  }
}

/**
 * Erro específico do Circuit Breaker
 */
export class CircuitBreakerError extends Error {
  public readonly circuitName: string;

  constructor(message: string, circuitName: string) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.circuitName = circuitName;
  }
}

// Instâncias pré-configuradas para integrações comuns
export const correiosCircuitBreaker = new CircuitBreaker({
  name: 'correios',
  failureThreshold: 5,       // Mais tolerante a falhas ocasionais
  resetTimeoutMs: 15000,     // 15s - Recupera mais rápido
  successThreshold: 1,       // Menos testes necessários para fechar
  callTimeoutMs: 30000,
});

export const viaCepCircuitBreaker = new CircuitBreaker({
  name: 'viacep',
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  successThreshold: 1,
  callTimeoutMs: 5000,
});

export const jtCircuitBreaker = new CircuitBreaker({
  name: 'jt',
  failureThreshold: 5,
  resetTimeoutMs: 15000,
  successThreshold: 1,
  callTimeoutMs: 30000,
});

export const loggiCircuitBreaker = new CircuitBreaker({
  name: 'loggi',
  failureThreshold: 5,
  resetTimeoutMs: 15000,
  successThreshold: 1,
  callTimeoutMs: 30000,
});

export const totalExpressCircuitBreaker = new CircuitBreaker({
  name: 'total-express',
  failureThreshold: 5,
  resetTimeoutMs: 15000,
  successThreshold: 1,
  callTimeoutMs: 30000,
});
