/**
 * GET/POST /api/cron/pix-monitor
 *
 * Trigger manual para o monitor de PIX.
 * O processamento real acontece no worker BullMQ (payment.pix-monitor).
 *
 * Este endpoint enfileira um job manual no BullMQ ao invés de processar inline.
 * O job repeatable continua rodando a cada 2 minutos via worker.
 *
 * Mantido para compatibilidade com Vercel Cron e triggers manuais.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import crypto from 'crypto';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import type { PixMonitorJobPayload } from '@/platform/queue/types';
import { logger } from '@/platform/logging/logger';

export const maxDuration = 30;

function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    crypto.timingSafeEqual(aBuffer, Buffer.alloc(aBuffer.length));
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function isAuthorized(headers: Headers): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = headers.get('x-cron-secret');
  if (cronSecret && requestSecret && secureCompare(requestSecret, cronSecret)) {
    return true;
  }
  if (headers.get('x-vercel-cron') === '1') {
    return true;
  }
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  return false;
}

interface TriggerResponse {
  success: boolean;
  message: string;
  jobId: string | null;
  timestamp: string;
}

async function triggerPixMonitor(headers: Headers): Promise<{ data: TriggerResponse }> {
  if (!isAuthorized(headers)) {
    throw ApiError.unauthorized('Não autorizado');
  }

  logger.info({ event: 'pix_monitor_manual_trigger' }, 'Manual PIX monitor trigger via cron endpoint');

  const queue = getQueue<PixMonitorJobPayload>(QUEUE_NAMES.PAYMENT_PIX_MONITOR);

  const job = await queue.add(
    'monitor',
    { trigger: 'manual' },
    {
      priority: JOB_PRIORITY.HIGH,
      jobId: `pix-monitor-manual-${Date.now()}`,
    }
  );

  return {
    data: {
      success: true,
      message: 'Job enfileirado para processamento pelo worker BullMQ',
      jobId: job.id ?? null,
      timestamp: new Date().toISOString(),
    },
  };
}

export const GET = withApiHandler<TriggerResponse>(async (context) => {
  return triggerPixMonitor(context.req.headers);
});

export const POST = withApiHandler<TriggerResponse>(async (context) => {
  return triggerPixMonitor(context.req.headers);
});
