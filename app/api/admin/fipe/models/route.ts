/**
 * GET /api/admin/fipe/models
 *
 * Lista modelos de veículos FIPE ativos para uso em selects
 * Query params:
 *   - brandId: ID da marca (obrigatório)
 *   - search: filtro por nome (opcional)
 */

import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { prisma } from '@/lib/db';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';

export const GET = withApiHandler(async ({ req }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const search = searchParams.get('search') || '';

  if (!brandId) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'brandId é obrigatório',
      status: 400,
    });
  }

  // Verificar se marca existe
  const brand = await prisma.fipeVehicleBrand.findUnique({
    where: { id: brandId },
    select: { id: true, name: true },
  });

  if (!brand) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Marca não encontrada',
      status: 404,
    });
  }

  const models = await prisma.fipeVehicleModel.findMany({
    where: {
      brandId,
      isActive: true,
      ...(search && {
        name: { contains: search, mode: 'insensitive' },
      }),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      fipeCode: true,
      name: true,
    },
  });

  return {
    data: {
      brand: brand.name,
      models,
    },
  };
});
