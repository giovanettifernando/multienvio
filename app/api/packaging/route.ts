import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { packagingCreateSchema } from '@/shared/validation/packaging';
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

type PackagingListResponse = PackagingTemplate[];

/**
 * GET /api/packaging
 * Lista todas as embalagens do usuário autenticado
 */
export const GET = withApiHandler<PackagingListResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const templates = await packagingService.listByUser(session.userId);

  // Converter Decimal para number no response
  const result = templates.map((t) => ({
    id: t.id,
    name: t.name,
    lengthCm: Number(t.lengthCm),
    widthCm: Number(t.widthCm),
    heightCm: Number(t.heightCm),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return {
    data: result,
    headers: { 'Cache-Control': 'private, max-age=300' }, // 5min — embalagens mudam raramente
  };
});

type PackagingCreateResponse = PackagingTemplate;

/**
 * POST /api/packaging
 * Cria uma nova embalagem para o usuário autenticado
 */
export const POST = withApiHandler<PackagingCreateResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const body = await context.req.json();

  const validation = packagingCreateSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'packaging_validation_error', errors: validation.error.flatten() }, 'Packaging validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  const template = await packagingService.create(session.userId, validation.data);

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

  return { data: result, status: 201 };
});
