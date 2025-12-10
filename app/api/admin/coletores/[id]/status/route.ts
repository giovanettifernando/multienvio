/**
 * API Route para atualizar status do coletor
 * PATCH /api/admin/coletores/[id]/status - Atualiza status (active/blocked)
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { updateCollectorStatus } from '@/lib/collectors/service';
import type { Collector } from '@/lib/collectors/types';
import { z } from 'zod';

const statusSchema = z.object({
  status: z.enum(['active', 'blocked']),
});

interface PatchCollectorStatusResponse {
  collector: Collector;
  message: string;
}

/**
 * PATCH /api/admin/coletores/[id]/status
 * Atualiza o status de um coletor
 */
export const PATCH = withApiHandler<PatchCollectorStatusResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.COLETORES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id } = params;
  const body = await req.json();

  // Validate status
  const validation = statusSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'validation_error',
      message: 'Status inválido',
      status: 400,
      details: { errors: validation.error.flatten() },
    });
  }

  const { status } = validation.data;

  try {
    const collector = await updateCollectorStatus(id, status);

    logger.info('admin_collector_status_updated', {
      staffId: session.staffId,
      collectorId: id,
      newStatus: status,
    });

    return {
      data: {
        collector,
        message: `Coletor ${status === 'active' ? 'ativado' : 'bloqueado'} com sucesso`,
      },
    };
  } catch (error) {
    // Prisma not found error
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      throw new ApiError({ code: 'not_found', message: 'Coletor não encontrado', status: 404 });
    }
    throw error;
  }
});
