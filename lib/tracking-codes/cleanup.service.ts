/**
 * Serviço de limpeza de reservas de códigos de rastreamento expirados
 *
 * Remove automaticamente reservas que:
 * - Expiraram (expiresAt < now)
 * - Não foram usadas (usedAt IS NULL)
 *
 * Executado automaticamente via instrumentation.ts quando o servidor inicia.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Intervalo de limpeza: 1 hora (em ms)
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// Manter reservas usadas por 30 dias para auditoria
const USED_RESERVATION_RETENTION_DAYS = 30;

let cleanupIntervalId: NodeJS.Timeout | null = null;

export interface CleanupResult {
  expiredDeleted: number;
  oldUsedDeleted: number;
  duration: number;
}

/**
 * Remove reservas expiradas e não utilizadas
 */
export async function cleanupExpiredReservations(): Promise<CleanupResult> {
  const startTime = Date.now();

  try {
    const now = new Date();

    // 1. Deletar reservas expiradas que não foram usadas
    const expiredResult = await prisma.trackingCodeReservation.deleteMany({
      where: {
        expiresAt: { lt: now },
        usedAt: null,
      },
    });

    // 2. Deletar reservas usadas muito antigas (housekeeping)
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - USED_RESERVATION_RETENTION_DAYS);

    const oldUsedResult = await prisma.trackingCodeReservation.deleteMany({
      where: {
        usedAt: { lt: retentionDate },
      },
    });

    const duration = Date.now() - startTime;

    const result: CleanupResult = {
      expiredDeleted: expiredResult.count,
      oldUsedDeleted: oldUsedResult.count,
      duration,
    };

    // Log apenas se algo foi deletado
    if (result.expiredDeleted > 0 || result.oldUsedDeleted > 0) {
      logger.info({
        event: 'tracking_code_cleanup_complete',
        expiredDeleted: result.expiredDeleted,
        oldUsedDeleted: result.oldUsedDeleted,
        durationMs: duration,
      }, `Cleanup: ${result.expiredDeleted} expired, ${result.oldUsedDeleted} old used reservations deleted`);
    }

    return result;
  } catch (error) {
    logger.error({
      event: 'tracking_code_cleanup_error',
      err: error,
    }, 'Error during tracking code cleanup');

    throw error;
  }
}

/**
 * Inicia o job de limpeza periódico
 * Chamado pelo instrumentation.ts na inicialização do servidor
 */
export function startCleanupJob(): void {
  // Evitar múltiplas instâncias
  if (cleanupIntervalId) {
    logger.warn({ event: 'tracking_code_cleanup_already_running' }, 'Cleanup job already running');
    return;
  }

  logger.info({
    event: 'tracking_code_cleanup_starting',
    intervalMinutes: CLEANUP_INTERVAL_MS / 60000,
  }, 'Starting tracking code cleanup job');

  // Executar imediatamente na primeira vez
  cleanupExpiredReservations().catch((error) => {
    logger.error({ event: 'tracking_code_cleanup_initial_error', err: error }, 'Initial cleanup failed');
  });

  // Agendar execução periódica
  cleanupIntervalId = setInterval(() => {
    cleanupExpiredReservations().catch((error) => {
      logger.error({ event: 'tracking_code_cleanup_interval_error', err: error }, 'Scheduled cleanup failed');
    });
  }, CLEANUP_INTERVAL_MS);

  // Garantir que o intervalo não impeça o processo de encerrar
  cleanupIntervalId.unref();
}

/**
 * Para o job de limpeza (usado em testes ou shutdown graceful)
 */
export function stopCleanupJob(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger.info({ event: 'tracking_code_cleanup_stopped' }, 'Cleanup job stopped');
  }
}
