/**
 * POST /api/admin/fipe/sync
 *
 * Dispara sincronização manual da base FIPE
 * Requer permissão INTEGRACOES ou superAdmin
 */

import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { canAccess } from '@/modules/auth/application/permissions';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { syncFipeBrandsAndModels, getFipeStats, type SyncOptions } from '@/platform/integrations/fipe';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

// Timeout maior para sync (5 minutos)
export const maxDuration = 300;

export const POST = withApiHandler(async ({ req }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  const staff = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: { isSuperAdmin: true, permissions: true, status: true },
  });

  if (!staff || staff.status !== 'ACTIVE') {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Acesso negado',
      status: 403,
    });
  }

  // Requer permissão INTEGRACOES ou superAdmin
  if (!canAccess(staff, AdminPermission.INTEGRACOES)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Acesso negado - requer permissão INTEGRACOES',
      status: 403,
    });
  }

  // Parse body para opções
  let options: SyncOptions = { vehicleTypes: ['cars'] };

  try {
    const body = await req.json();
    if (body.vehicleTypes && Array.isArray(body.vehicleTypes)) {
      options.vehicleTypes = body.vehicleTypes.filter(
        (t: string) => ['cars', 'motorcycles', 'trucks'].includes(t)
      );
    }
    if (typeof body.deactivateOld === 'boolean') {
      options.deactivateOld = body.deactivateOld;
    }
  } catch {
    // Corpo vazio ou inválido, usa defaults
  }

  // Executar sync
  const result = await syncFipeBrandsAndModels(options);

  // Buscar estatísticas atualizadas
  const stats = await getFipeStats();

  return {
    data: {
      success: result.errors.length === 0,
      result: {
        referenceCode: result.referenceCode,
        referenceMonth: result.referenceMonth,
        vehicleTypes: result.vehicleTypes,
        brands: result.brands,
        models: result.models,
        durationMs: result.durationMs,
        errorsCount: result.errors.length,
      },
      stats,
      errors: result.errors.length > 0 ? result.errors.slice(0, 20) : undefined,
    },
  };
});

/**
 * GET /api/admin/fipe/sync
 *
 * Retorna estatísticas da base FIPE local
 */
export const GET = withApiHandler(async ({ req }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  const staff = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: { isSuperAdmin: true, permissions: true, status: true },
  });

  if (!staff || staff.status !== 'ACTIVE') {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Acesso negado',
      status: 403,
    });
  }

  if (!canAccess(staff, AdminPermission.INTEGRACOES)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Acesso negado - requer permissão INTEGRACOES',
      status: 403,
    });
  }

  const stats = await getFipeStats();

  // Buscar contagem por tipo de veículo
  const brandsByType = await prisma.fipeVehicleBrand.groupBy({
    by: ['vehicleType'],
    where: { isActive: true },
    _count: { id: true },
  });

  const modelsByType = await prisma.fipeVehicleModel.groupBy({
    by: ['vehicleType'],
    where: { isActive: true },
    _count: { id: true },
  });

  return {
    data: {
      stats,
      byVehicleType: {
        brands: brandsByType.reduce((acc, item) => {
          acc[item.vehicleType] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        models: modelsByType.reduce((acc, item) => {
          acc[item.vehicleType] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
    },
  };
});
