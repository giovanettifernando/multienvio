/**
 * API Routes para Coletor Individual
 * GET    /api/admin/coletores/[id] - Busca coletor por ID
 * PATCH  /api/admin/coletores/[id] - Atualiza coletor
 * DELETE /api/admin/coletores/[id] - Deleta coletor
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import {
  getCollectorById,
  updateCollector,
  deleteCollector,
} from '@/lib/collectors/service';
import { collectorFormSchema } from '@/lib/collectors/schemas';
import type { Collector } from '@/lib/collectors/types';
import { z } from 'zod';

interface GetCollectorResponse {
  collector: Collector;
}

interface PatchCollectorResponse {
  collector: Collector;
  message: string;
}

interface DeleteCollectorResponse {
  message: string;
}

/**
 * GET /api/admin/coletores/[id]
 * Busca um coletor por ID
 */
export const GET = withApiHandler<GetCollectorResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.COLETORES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id } = params;

  const collector = await getCollectorById(id);

  if (!collector) {
    throw new ApiError({ code: 'not_found', message: 'Coletor não encontrado', status: 404 });
  }

  logger.info('admin_coletores_get', { staffId: session.staffId, collectorId: id });

  return { data: { collector } };
});

/**
 * PATCH /api/admin/coletores/[id]
 * Atualiza um coletor
 */
export const PATCH = withApiHandler<PatchCollectorResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { id } = params;
  const body = await req.json();

  try {
    // Validate with Zod schema
    const validatedData = collectorFormSchema.parse(body);

    const collector = await updateCollector(id, validatedData);

    logger.info('admin_coletores_update', { staffId: session.staffId, collectorId: id });

    return { data: { collector, message: 'Coletor atualizado com sucesso' } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError({
        code: 'validation_error',
        message: 'Dados inválidos',
        status: 400,
        details: { errors: error.issues },
      });
    }

    // Prisma not found error
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      throw new ApiError({ code: 'not_found', message: 'Coletor não encontrado', status: 404 });
    }

    throw error;
  }
});

/**
 * DELETE /api/admin/coletores/[id]
 * Deleta um coletor
 */
export const DELETE = withApiHandler<DeleteCollectorResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { id } = params;

  try {
    await deleteCollector(id);

    logger.info('admin_coletores_delete', { staffId: session.staffId, collectorId: id });

    return { data: { message: 'Coletor excluído com sucesso' } };
  } catch (error) {
    // Prisma not found error
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      throw new ApiError({ code: 'not_found', message: 'Coletor não encontrado', status: 404 });
    }

    throw error;
  }
});
