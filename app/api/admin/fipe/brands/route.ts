/**
 * GET /api/admin/fipe/brands
 *
 * Lista marcas de veículos FIPE ativas para uso em selects
 * Query params:
 *   - vehicleType: 'cars' | 'motorcycles' | 'trucks' (default: 'cars')
 *   - search: filtro por nome (opcional)
 */

import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { prisma } from '@/platform/db/db';
import type { FipeVehicleType } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

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
  const vehicleType = (searchParams.get('vehicleType') || 'cars') as FipeVehicleType;
  const search = searchParams.get('search') || '';

  // Validar vehicleType
  if (!['cars', 'motorcycles', 'trucks'].includes(vehicleType)) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
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
