/**
 * GET /api/public/fipe/brands
 *
 * Lista marcas de veículos FIPE ativas (endpoint público para cadastro)
 * Query params:
 *   - vehicleType: 'cars' | 'motorcycles' | 'trucks' (default: 'cars')
 *   - search: filtro por nome (opcional)
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import type { FipeVehicleType } from '@prisma/client';

interface FipeBrand {
  id: string;
  fipeCode: string;
  name: string;
}

interface FipeBrandsResponse {
  brands: FipeBrand[];
}

// Cache por 24 horas - dados FIPE são estáticos

export const GET = withApiHandler<FipeBrandsResponse>(async ({ req }) => {
  const { searchParams } = new URL(req.url);
  const vehicleType = (searchParams.get('vehicleType') || 'cars') as FipeVehicleType;
  const search = searchParams.get('search') || '';

  // Validar vehicleType
  if (!['cars', 'motorcycles', 'trucks'].includes(vehicleType)) {
    throw new ApiError({
      code: 'INVALID_VEHICLE_TYPE',
      message: 'vehicleType inválido',
      status: 400,
    });
  }

  const brands = await prisma.fipeVehicleBrand.findMany({
    where: {
      vehicleType,
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

  return { data: { brands } };
});
