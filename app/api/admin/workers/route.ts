/**
 * GET  /api/admin/workers — Status dos workers + filas
 * POST /api/admin/workers — Ações: start, stop, restart
 *
 * Protegido por autenticação admin com permissão INTEGRACOES.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import {
  getWorkerStatus,
  startWorkerProcess,
  stopWorkerProcess,
  restartWorkerProcess,
  type WorkerStatus,
} from '@/platform/queue/worker-manager';

export const dynamic = 'force-dynamic';

/**
 * GET — Retorna status completo dos workers e métricas das filas
 */
export const GET = withApiHandler<WorkerStatus>(async (context) => {
  await requireAdminSession(context.req, AdminPermission.INTEGRACOES);

  const status = await getWorkerStatus();

  return { data: status };
});

interface WorkerActionResponse {
  success: boolean;
  message: string;
}

/**
 * POST — Executa ação nos workers: start, stop, restart
 *
 * Body: { action: "start" | "stop" | "restart" }
 */
export const POST = withApiHandler<WorkerActionResponse>(async (context) => {
  await requireAdminSession(context.req, AdminPermission.INTEGRACOES);

  let body: { action?: string };
  try {
    body = await context.req.json();
  } catch {
    throw ApiError.badRequest('JSON inválido');
  }

  const { action } = body;

  if (!action || !['start', 'stop', 'restart'].includes(action)) {
    throw ApiError.badRequest('Ação inválida. Use: start, stop, restart');
  }

  let result: { success: boolean; message: string };

  switch (action) {
    case 'start':
      result = startWorkerProcess();
      break;
    case 'stop':
      result = await stopWorkerProcess();
      break;
    case 'restart':
      result = await restartWorkerProcess();
      break;
    default:
      throw ApiError.badRequest('Ação inválida');
  }

  return {
    data: result,
    status: result.success ? 200 : 500,
  };
});
