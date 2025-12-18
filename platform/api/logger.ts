import { logger } from '@/platform/logging/logger';
import type { LoggerInterface } from '@/platform/logging/logger';

// ============================================================================
// LOGGER DE REQUEST PARA API ROUTES
// Usa logger estruturado internamente, mantem interface existente
// ============================================================================

type LoggerContext = {
  requestId: string;
  path: string;
  method: string;
  ip?: string | null;
  userAgent?: string | null;
  userId?: string;
  staffId?: string;
};

type LogPayload = Record<string, unknown> | undefined;

/**
 * Cria um logger para request com contexto
 * Usa child logger para incluir contexto em todos os logs
 */
export function createRequestLogger(context: LoggerContext) {
  // Criar child logger com contexto do request
  const childLogger = logger.child({
    requestId: context.requestId,
    path: context.path,
    method: context.method,
    ip: context.ip ?? undefined,
    userAgent: context.userAgent ?? undefined,
    userId: context.userId,
    staffId: context.staffId,
  });

  return {
    info(event: string, payload?: LogPayload) {
      childLogger.info({ event, ...payload }, event);
    },
    warn(event: string, payload?: LogPayload) {
      childLogger.warn({ event, ...payload }, event);
    },
    error(event: string, payload?: LogPayload) {
      childLogger.error({ event, ...payload }, event);
    },
    debug(event: string, payload?: LogPayload) {
      childLogger.debug({ event, ...payload }, event);
    },
    audit(event: string, payload?: LogPayload) {
      childLogger.info({ event, category: 'audit', ...payload }, `[AUDIT] ${event}`);
    },
    // Expor o logger subjacente para uso avancado
    _logger: childLogger as LoggerInterface,
  };
}

// Re-export o tipo do logger para uso em outros arquivos
export type RequestLogger = ReturnType<typeof createRequestLogger>;
