/**
 * POST /api/admin/fipe/sync
 *
 * Enfileira sincronização da base FIPE via BullMQ.
 * Retorna 202 imediatamente — o worker processa em background.
 * Requer permissão INTEGRACOES ou superAdmin.
 */

import { requireAdminSession } from '@/platform/auth/require-session';
import { canAccess } from '@/modules/auth/application/permissions';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { getFipeStats } from '@/platform/integrations/fipe';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getQueue, QUEUE_NAMES, type FipeSyncJobPayload } from '@/platform/queue';

type FipeVehicleType = 'cars' | 'motorcycles' | 'trucks';

export const POST = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.CONFIGURACOES);

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

  // Parse body para opções
  let vehicleTypes: FipeVehicleType[] = ['cars'];
  let forceUpdate = false;

  try {
    const body = await req.json();
    if (body.vehicleTypes && Array.isArray(body.vehicleTypes)) {
      vehicleTypes = body.vehicleTypes.filter(
        (t: string) => ['cars', 'motorcycles', 'trucks'].includes(t)
      ) as FipeVehicleType[];
    }
    if (typeof body.forceUpdate === 'boolean') {
      forceUpdate = body.forceUpdate;
    }
  } catch {
    // Corpo vazio ou inválido, usa defaults
  }

  // Enfileirar um job 'brands' por tipo de veículo
  const queue = getQueue<FipeSyncJobPayload>(QUEUE_NAMES.FIPE_SYNC);

  const jobs = vehicleTypes.map((vt) => ({
    name: 'brands',
    data: {
      mode: 'brands' as const,
      vehicleType: vt,
      forceUpdate,
    },
    opts: {
      jobId: `fipe-brands-${vt}-${Date.now()}`,
    },
  }));

  await queue.addBulk(jobs);

  return {
    status: 202,
    data: {
      message: `Sincronização FIPE enfileirada para ${vehicleTypes.length} tipo(s) de veículo`,
      vehicleTypes,
      jobsEnqueued: jobs.length,
    },
  };
});

/**
 * GET /api/admin/fipe/sync
 *
 * Retorna estatísticas da base FIPE local
 */
export const GET = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.CONFIGURACOES);

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
