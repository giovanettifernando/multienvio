import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { packagingUpdateSchema } from '@/shared/validation/packaging';
import * as packagingService from '@/modules/quotes/application/packaging.service';
import { logger } from '@/platform/logging/logger';

interface PackagingTemplate {
  id: string;
  name: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  createdAt: string;
  updatedAt: string;
}

type PackagingUpdateResponse = PackagingTemplate;

/**
 * PUT /api/packaging/[id]
 * Atualiza uma embalagem existente do usuário
 */
export const PUT = withApiHandler<PackagingUpdateResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const id = context.params.id;
  const body = await context.req.json();

  const validation = packagingUpdateSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'packaging_validation_error', errors: validation.error.flatten() }, 'Packaging validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  try {
    const template = await packagingService.update(session.userId, id, validation.data);

    // Converter Decimal para number no response
    const result = {
      id: template.id,
      name: template.name,
      lengthCm: Number(template.lengthCm),
      widthCm: Number(template.widthCm),
      heightCm: Number(template.heightCm),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };

    return { data: result };
  } catch (error) {
    if (error instanceof Error && error.message === 'Embalagem não encontrada') {
      throw new ApiError({ code: 'not_found', message: error.message, status: 404 });
    }
    throw error;
  }
});

type PackagingDeleteResponse = null;

/**
 * DELETE /api/packaging/[id]
 * Remove uma embalagem do usuário
 */
export const DELETE = withApiHandler<PackagingDeleteResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const id = context.params.id;

  try {
    await packagingService.remove(session.userId, id);
    return { data: null, status: 204 };
  } catch (error) {
    if (error instanceof Error && error.message === 'Embalagem não encontrada') {
      throw new ApiError({ code: 'not_found', message: error.message, status: 404 });
    }
    throw error;
  }
});
