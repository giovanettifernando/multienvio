/**
 * GET  /api/admin/workers/jobs?queue=xxx&status=failed — Lista jobs falhados
 * POST /api/admin/workers/jobs — Retry/delete jobs falhados
 *
 * Protegido por autenticação admin com permissão INTEGRACOES.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { Queue } from 'bullmq';
import { queueConnection } from '@/platform/queue/connection';
import { getAllQueueNames } from '@/platform/queue/queues';

export const dynamic = 'force-dynamic';

// ============================================================================
// Types
// ============================================================================

interface FailedJob {
  id: string;
  name: string;
  queue: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  maxAttempts: number;
  timestamp: number;
  finishedOn: number | null;
}

interface FailedJobsResponse {
  jobs: FailedJob[];
  total: number;
  queue: string;
}

interface JobActionResponse {
  success: boolean;
  message: string;
  affected: number;
}

// ============================================================================
// GET — Lista jobs falhados de uma fila
// ============================================================================

export const GET = withApiHandler<FailedJobsResponse>(async (context) => {
  await requireAdminSession(context.req, AdminPermission.INTEGRACOES);

  const url = new URL(context.req.url);
  const queueName = url.searchParams.get('queue');
  const page = parseInt(url.searchParams.get('page') || '0', 10);
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '50', 10), 100);

  if (!queueName) {
    throw ApiError.badRequest('Parâmetro "queue" é obrigatório');
  }

  // Validar que a fila existe
  const validQueues = getAllQueueNames();
  if (!validQueues.includes(queueName as typeof validQueues[number])) {
    throw ApiError.badRequest(`Fila "${queueName}" não encontrada`);
  }

  const queue = new Queue(queueName, { connection: queueConnection });

  try {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    const failedJobs = await queue.getFailed(start, end);
    const failedCount = await queue.getFailedCount();

    const jobs: FailedJob[] = failedJobs.map((job) => ({
      id: job.id ?? '',
      name: job.name,
      queue: queueName,
      data: job.data,
      failedReason: job.failedReason ?? 'Unknown',
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts?.attempts ?? 0,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn ?? null,
    }));

    return {
      data: {
        jobs,
        total: failedCount,
        queue: queueName,
      },
    };
  } finally {
    await queue.close();
  }
});

// ============================================================================
// POST — Ações em jobs falhados (retry, delete, retryAll, deleteAll)
// ============================================================================

export const POST = withApiHandler<JobActionResponse>(async (context) => {
  await requireAdminSession(context.req, AdminPermission.INTEGRACOES);

  let body: { action?: string; queue?: string; jobIds?: string[] };
  try {
    body = await context.req.json();
  } catch {
    throw ApiError.badRequest('JSON inválido');
  }

  const { action, queue: queueName, jobIds } = body;

  if (!action || !['retry', 'delete', 'retryAll', 'deleteAll'].includes(action)) {
    throw ApiError.badRequest('Ação inválida. Use: retry, delete, retryAll, deleteAll');
  }

  if (!queueName) {
    throw ApiError.badRequest('Campo "queue" é obrigatório');
  }

  const validQueues = getAllQueueNames();
  if (!validQueues.includes(queueName as typeof validQueues[number])) {
    throw ApiError.badRequest(`Fila "${queueName}" não encontrada`);
  }

  const queue = new Queue(queueName, { connection: queueConnection });

  try {
    let affected = 0;

    switch (action) {
      case 'retry': {
        if (!jobIds || jobIds.length === 0) {
          throw ApiError.badRequest('Campo "jobIds" é obrigatório para retry');
        }
        for (const jobId of jobIds) {
          const job = await queue.getJob(jobId);
          if (job) {
            await job.retry();
            affected++;
          }
        }
        break;
      }

      case 'delete': {
        if (!jobIds || jobIds.length === 0) {
          throw ApiError.badRequest('Campo "jobIds" é obrigatório para delete');
        }
        for (const jobId of jobIds) {
          const job = await queue.getJob(jobId);
          if (job) {
            await job.remove();
            affected++;
          }
        }
        break;
      }

      case 'retryAll': {
        const failedJobs = await queue.getFailed(0, 1000);
        for (const job of failedJobs) {
          await job.retry();
          affected++;
        }
        break;
      }

      case 'deleteAll': {
        await queue.clean(0, 0, 'failed');
        const count = await queue.getFailedCount();
        affected = count === 0 ? 1 : 0; // Assume success if count is 0
        break;
      }
    }

    return {
      data: {
        success: true,
        message: `Ação "${action}" executada com sucesso`,
        affected,
      },
    };
  } finally {
    await queue.close();
  }
});
