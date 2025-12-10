// ============================================================================
// LOGGER ESTRUTURADO
// Configuracao por ambiente (dev/prod)
// Usa JSON estruturado para compatibilidade com Next.js build
// ============================================================================

const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[logLevel as LogLevel] ?? LOG_LEVELS.info;

// Campos sensiveis para redact
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
];

function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function formatLog(level: LogLevel, data: Record<string, unknown>, message: string): string {
  const timestamp = new Date().toISOString();
  const redacted = redactSensitive(data);
  const entry = {
    timestamp,
    level,
    msg: message,
    env: process.env.NODE_ENV,
    service: 'envio-legal',
    ...redacted,
  };

  if (isDev && !isTest) {
    // Em dev, formato mais legivel
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';
    const color = levelColors[level];
    const dataStr = Object.keys(redacted).length > 0 ? ` ${JSON.stringify(redacted)}` : '';
    return `${color}[${timestamp}] ${level.toUpperCase()}${reset}: ${message}${dataStr}`;
  }

  // Em prod, JSON estruturado
  return JSON.stringify(entry);
}

function shouldLog(level: LogLevel): boolean {
  if (isTest) return false;
  return LOG_LEVELS[level] >= currentLevel;
}

function writeLog(level: LogLevel, data: Record<string, unknown>, message: string) {
  if (!shouldLog(level)) return;

  const formatted = formatLog(level, data, message);
  const consoleMethod = level === 'error' ? console.error :
                        level === 'warn' ? console.warn :
                        console.log;
  consoleMethod(formatted);
}

// ============================================================================
// LOGGER PRINCIPAL
// ============================================================================

interface LoggerInterface {
  debug(data: Record<string, unknown>, message: string): void;
  info(data: Record<string, unknown>, message: string): void;
  warn(data: Record<string, unknown>, message: string): void;
  error(data: Record<string, unknown>, message: string): void;
  child(context: Record<string, unknown>): LoggerInterface;
}

function createLogger(baseContext: Record<string, unknown> = {}): LoggerInterface {
  return {
    debug(data: Record<string, unknown>, message: string) {
      writeLog('debug', { ...baseContext, ...data }, message);
    },
    info(data: Record<string, unknown>, message: string) {
      writeLog('info', { ...baseContext, ...data }, message);
    },
    warn(data: Record<string, unknown>, message: string) {
      writeLog('warn', { ...baseContext, ...data }, message);
    },
    error(data: Record<string, unknown>, message: string) {
      writeLog('error', { ...baseContext, ...data }, message);
    },
    child(context: Record<string, unknown>) {
      return createLogger({ ...baseContext, ...context });
    },
  };
}

export const logger = createLogger();

// ============================================================================
// LOGGER PARA REQUESTS (com correlation ID)
// ============================================================================

export interface RequestLogContext {
  requestId: string;
  path: string;
  method: string;
  ip?: string | null;
  userAgent?: string | null;
  userId?: string;
  staffId?: string;
}

/**
 * Cria um logger filho com contexto de request
 */
export function createRequestLogger(context: RequestLogContext) {
  return logger.child({
    requestId: context.requestId,
    path: context.path,
    method: context.method,
    ip: context.ip || undefined,
    userAgent: context.userAgent || undefined,
    userId: context.userId,
    staffId: context.staffId,
  });
}

// ============================================================================
// HELPERS PARA LOGGING COMUM
// ============================================================================

/**
 * Log de erro com stack trace
 */
export function logError(
  log: LoggerInterface,
  error: Error | unknown,
  context?: Record<string, unknown>
) {
  const err = error instanceof Error ? error : new Error(String(error));
  log.error(
    {
      event: 'error',
      err: {
        message: err.message,
        name: err.name,
        stack: isDev ? err.stack : undefined,
      },
      ...context,
    },
    err.message
  );
}

/**
 * Log de auditoria (acoes importantes)
 */
export function logAudit(
  log: LoggerInterface,
  action: string,
  details: Record<string, unknown>
) {
  log.info(
    { event: 'audit', action, ...details },
    `Audit: ${action}`
  );
}

/**
 * Log de integracao externa
 */
export function logExternalCall(
  log: LoggerInterface,
  service: string,
  operation: string,
  success: boolean,
  durationMs?: number,
  details?: Record<string, unknown>
) {
  const logFn = success ? log.info.bind(log) : log.error.bind(log);
  logFn(
    {
      event: 'external_call',
      service,
      operation,
      success,
      durationMs,
      ...details,
    },
    `${service}.${operation} - ${success ? 'sucesso' : 'falha'}${durationMs ? ` (${durationMs}ms)` : ''}`
  );
}

// ============================================================================
// WRAPPER SIMPLES PARA COMPATIBILIDADE
// ============================================================================

export const log = {
  debug: (message: string, data?: Record<string, unknown>) => {
    logger.debug(data || {}, message);
  },
  info: (message: string, data?: Record<string, unknown>) => {
    logger.info(data || {}, message);
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    logger.warn(data || {}, message);
  },
  error: (message: string, data?: Record<string, unknown>) => {
    logger.error(data || {}, message);
  },
};

// Export default
export default logger;

// Export type for use in other files
export type { LoggerInterface };
