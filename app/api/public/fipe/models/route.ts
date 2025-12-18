/**
 * GET /api/public/fipe/models
 *
 * Lista modelos de veículos FIPE ativos (endpoint público para cadastro)
 * Query params:
 *   - brandId: ID da marca (obrigatório)
 *   - search: filtro por nome (opcional)
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';

interface FipeModel {
  id: string;
  fipeCode: string;
  name: string;
}

interface FipeModelsResponse {
  brand: string;
  models: FipeModel[];
}

export const GET = withApiHandler<FipeModelsResponse>(async ({ req }) => {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const search = searchParams.get('search') || '';

  if (!brandId) {
    throw new ApiError({
      code: 'MISSING_BRAND_ID',
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
      code: 'BRAND_NOT_FOUND',
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
