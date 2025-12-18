/**
 * GET/POST /api/cron/pix-monitor
 *
 * Cron job para monitorar pagamentos PIX pendentes
 *
 * Funcionalidades:
 * - Verifica status de PIX pendentes no Mercado Pago
 * - Marca PIX expirados como cancelados
 * - Registra PIX não realizados na carteira do usuário
 * - Limpa PIX muito antigos
 *
 * Segurança:
 * - Aceita apenas requisições com header X-Cron-Secret válido
 * - Ou requisições do mesmo host (cron interno)
 *
 * Uso:
 * - Configure um cron job para chamar este endpoint a cada 2-5 minutos
 * - Ex: curl -X POST -H "X-Cron-Secret: $SECRET" https://seusite.com/api/cron/pix-monitor
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import crypto from 'crypto';
import {
  monitorPendingPixPayments,
  cleanupOldPendingPix,
  type PixMonitorResult,
} from '@/platform/integrations/mercadopago/pix-monitor';
import { logger } from '@/platform/logging/logger';

export const maxDuration = 60; // 60 segundos de timeout

/**
 * SECURITY: Comparação constant-time para evitar timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    // Para evitar timing leak no comprimento, ainda fazemos a comparação
    // mas garantimos que retornamos false
    crypto.timingSafeEqual(aBuffer, Buffer.alloc(aBuffer.length));
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Valida se a requisição é autorizada
 */
function isAuthorized(headers: Headers): boolean {
  // 1. Verificar secret do cron com comparação constant-time
  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = headers.get('x-cron-secret');

  if (cronSecret && requestSecret && secureCompare(requestSecret, cronSecret)) {
    return true;
  }

  // 2. Verificar se é Vercel Cron (header especial)
  const vercelCron = headers.get('x-vercel-cron');
  if (vercelCron === '1') {
    return true;
  }

  // 3. Em desenvolvimento, permitir sem autenticação
  if (process.env.NODE_ENV === 'development') {
    logger.warn({ event: 'pix_monitor_dev_access' }, 'Allowing dev access without auth');
    return true;
  }

  return false;
}

interface PixMonitorResponse {
  success: boolean;
  message: string;
  timestamp: string;
  result: PixMonitorResult;
  cleanup: number;
  duration: number;
}

// GET para facilitar testes manuais
export const GET = withApiHandler<PixMonitorResponse>(async (context) => {
  const startTime = Date.now();

  // Verificar autorização
  if (!isAuthorized(context.req.headers)) {
    throw ApiError.unauthorized('Não autorizado');
  }

  logger.info({ event: 'pix_monitor_start' }, 'Starting PIX monitor');

  // 1. Monitorar PIX pendentes
  const result = await monitorPendingPixPayments();

  // 2. Limpar PIX muito antigos (uma vez por execução)
  const cleanedUp = await cleanupOldPendingPix();

  const duration = Date.now() - startTime;

  logger.info({
    event: 'pix_monitor_complete',
    durationMs: duration,
    processed: result.processed,
    approved: result.approved,
    expired: result.expired,
    cleanedUp,
  }, 'PIX monitor completed');

  return {
    data: {
      success: true,
      message: `Processados ${result.processed} pagamentos PIX`,
      timestamp: new Date().toISOString(),
      result,
      cleanup: cleanedUp,
      duration,
    },
  };
});

// POST para cron jobs
export const POST = withApiHandler<PixMonitorResponse>(async (context) => {
  const startTime = Date.now();

  // Verificar autorização
  if (!isAuthorized(context.req.headers)) {
    throw ApiError.unauthorized('Não autorizado');
  }

  logger.info({ event: 'pix_monitor_start' }, 'Starting PIX monitor');

  // 1. Monitorar PIX pendentes
  const result = await monitorPendingPixPayments();

  // 2. Limpar PIX muito antigos (uma vez por execução)
  const cleanedUp = await cleanupOldPendingPix();

  const duration = Date.now() - startTime;

  logger.info({
    event: 'pix_monitor_complete',
    durationMs: duration,
    processed: result.processed,
    approved: result.approved,
    expired: result.expired,
    cleanedUp,
  }, 'PIX monitor completed');

  return {
    data: {
      success: true,
      message: `Processados ${result.processed} pagamentos PIX`,
      timestamp: new Date().toISOString(),
      result,
      cleanup: cleanedUp,
      duration,
    },
  };
});
