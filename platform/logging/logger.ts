// ============================================================================
// LOGGER ESTRUTURADO COM PINO
// - Dev: pino-pretty no console para output legível
// - Prod/Staging: JSON estruturado + arquivo com rotação de 2 dias
// ============================================================================

import pino from 'pino';
import type { LoggerOptions, TransportSingleOptions, TransportMultiOptions } from 'pino';
import * as path from 'path';

const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

// Diretório de logs (pode ser customizado via env)
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// Campos sensíveis para redact
const redactPaths = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.apiKey',
  '*.authorization',
  '*.cookie',
];

// Configuração base do Pino
const baseConfig: LoggerOptions = {
  level: isTest ? 'silent' : logLevel,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  base: {
    service: 'envio-legal',
    env: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Transport para desenvolvimento: pino-pretty no console
const devTransport: TransportSingleOptions = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname,service,env',
    messageFormat: '{msg}',
    singleLine: false,
  },
};

// Transport para produção/staging: arquivo com rotação + console (JSON)
const prodTransport: TransportMultiOptions = {
  targets: [
    // Arquivo com rotação diária, mantendo 2 dias
    {
      target: 'pino-roll',
      options: {
        file: path.join(LOG_DIR, 'app'),
        frequency: 'daily',
        limit: {
          count: 2, // Mantém apenas 2 arquivos (2 dias)
        },
        mkdir: true,
        extension: '.log',
        dateFormat: 'yyyy-MM-dd',
      },
      level: logLevel,
    },
    // Console em JSON para docker logs / stdout
    {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
      level: logLevel,
    },
  ],
};

// Criar logger baseado no ambiente
function createPinoLogger(): pino.Logger {
  if (isTest) {
    return pino(baseConfig);
  }

  if (isDev) {
    return pino(baseConfig, pino.transport(devTransport));
  }

  // Produção/Staging: arquivo + console
  return pino(baseConfig, pino.transport(prodTransport));
}

const pinoLogger = createPinoLogger();

// ============================================================================
// INTERFACE DE COMPATIBILIDADE
// Mantém a mesma API do logger anterior para não quebrar imports existentes
// ============================================================================

export interface LoggerInterface {
  debug(data: Record<string, unknown>, message: string): void;
  info(data: Record<string, unknown>, message: string): void;
  warn(data: Record<string, unknown>, message: string): void;
  error(data: Record<string, unknown>, message: string): void;
  child(context: Record<string, unknown>): LoggerInterface;
}

function wrapPinoLogger(pinoInstance: pino.Logger): LoggerInterface {
  return {
    debug(data: Record<string, unknown>, message: string) {
      pinoInstance.debug(data, message);
    },
    info(data: Record<string, unknown>, message: string) {
      pinoInstance.info(data, message);
    },
    warn(data: Record<string, unknown>, message: string) {
      pinoInstance.warn(data, message);
    },
    error(data: Record<string, unknown>, message: string) {
      pinoInstance.error(data, message);
    },
    child(context: Record<string, unknown>) {
      return wrapPinoLogger(pinoInstance.child(context));
    },
  };
}

export const logger = wrapPinoLogger(pinoLogger);

// Export do logger pino nativo para casos que precisem de acesso direto
export const pinoInstance = pinoLogger;

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
 * Log de auditoria (ações importantes)
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
 * Log de integração externa
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
