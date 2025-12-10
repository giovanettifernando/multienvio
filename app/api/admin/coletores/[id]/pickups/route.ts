/**
 * GET /api/admin/coletores/[id]/pickups
 *
 * Lista coletas do coletor com filtro de período e estatísticas
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';

interface PickupItem {
  id: string;
  status: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  scannedCode: string | null;
  scheduleAt: string | null;
  createdAt: string;
  shipment: {
    id: string;
    trackingCode: string;
    carrierTrackingCode: string | null;
    carrier: string | null;
    service: string | null;
    weight: number;
    declaredValue: number;
    recipientName: string | null;
    destinationCity: string;
    destinationState: string;
    pickupFee: number | null;
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface PickupStats {
  totalPickups: number;
  totalKm: number;
  totalCommission: number;
  dateFrom: string;
  dateTo: string;
}

interface GetCollectorPickupsResponse {
  items: PickupItem[];
  page: number;
  pageSize: number;
  total: number;
  stats: PickupStats;
}

export const GET = withApiHandler<GetCollectorPickupsResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.COLETORES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id } = params;
  const { searchParams } = new URL(req.url);

  // Parse date filters - default to start of current month to today
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');

  const dateFrom = dateFromParam ? new Date(dateFromParam) : startOfMonth;
  const dateTo = dateToParam ? new Date(dateToParam) : now;

  // Ensure dateTo includes the full day
  dateTo.setHours(23, 59, 59, 999);

  // Pagination
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const skip = (page - 1) * pageSize;

  // Status filter (optional)
  const statusFilter = searchParams.get('status');

  // Verify collector exists
  const collector = await prisma.collector.findUnique({
    where: { id },
    select: {
      id: true,
      commissionKind: true,
      commissionAmount: true,
      commissionAmountPerKm: true,
    },
  });

  if (!collector) {
    throw new ApiError({ code: 'not_found', message: 'Coletor não encontrado', status: 404 });
  }

  // Build where clause
  const whereClause: {
    collectorId: string;
    collectedAt?: { gte: Date; lte: Date };
    status?: string | { in: string[] };
  } = {
    collectorId: id,
    collectedAt: {
      gte: dateFrom,
      lte: dateTo,
    },
  };

  if (statusFilter && statusFilter !== 'all') {
    whereClause.status = statusFilter;
  } else {
    // By default, show only completed pickups (COLLECTED or COMPLETED)
    whereClause.status = { in: ['COLLECTED', 'COMPLETED'] };
  }

  // Fetch pickups with shipment data
  const [pickups, total] = await Promise.all([
    prisma.pickupRequest.findMany({
      where: whereClause,
      include: {
        shipment: {
          select: {
            id: true,
            platformTrackingCode: true,
            carrierTrackingCode: true,
            carrier: true,
            service: true,
            weight: true,
            declaredValue: true,
            recipientName: true,
            destinationCity: true,
            destinationState: true,
            originCep: true,
            pickupFee: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { collectedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.pickupRequest.count({ where: whereClause }),
  ]);

  // Calculate statistics for the filtered period
  const statsWhere = {
    collectorId: id,
    collectedAt: {
      gte: dateFrom,
      lte: dateTo,
    },
    status: { in: ['COLLECTED', 'COMPLETED'] },
  };

  const statsPickups = await prisma.pickupRequest.findMany({
    where: statsWhere,
    include: {
      shipment: {
        select: {
          pickupFee: true,
        },
      },
    },
  });

  // Calculate totals
  const totalPickups = statsPickups.length;
  const totalCommission = statsPickups.reduce((acc, pickup) => {
    return acc + (pickup.shipment?.pickupFee || 0);
  }, 0);

  // Note: We don't have km tracking per pickup in the current schema
  const totalKm = 0; // Placeholder - would need distanceKm field in schema

  logger.info('admin_collector_pickups_list', {
    staffId: session.staffId,
    collectorId: id,
    total,
    page,
  });

  return {
    data: {
      items: pickups.map((pickup) => ({
        id: pickup.id,
        status: pickup.status,
        originCep: pickup.originCep,
        originAddress: pickup.originAddress,
        originCity: pickup.originCity,
        originUf: pickup.originUf,
        collectedAt: pickup.collectedAt?.toISOString() || null,
        collectedBy: pickup.collectedBy,
        scannedCode: pickup.scannedCode,
        scheduleAt: pickup.scheduleAt?.toISOString() || null,
        createdAt: pickup.createdAt.toISOString(),
        shipment: pickup.shipment
          ? {
              id: pickup.shipment.id,
              trackingCode: pickup.shipment.platformTrackingCode,
              carrierTrackingCode: pickup.shipment.carrierTrackingCode,
              carrier: pickup.shipment.carrier,
              service: pickup.shipment.service,
              weight: pickup.shipment.weight,
              declaredValue: pickup.shipment.declaredValue,
              recipientName: pickup.shipment.recipientName,
              destinationCity: pickup.shipment.destinationCity,
              destinationState: pickup.shipment.destinationState,
              pickupFee: pickup.shipment.pickupFee,
            }
          : null,
        user: pickup.user
          ? {
              id: pickup.user.id,
              name: pickup.user.name,
              email: pickup.user.email,
            }
          : null,
      })),
      page,
      pageSize,
      total,
      stats: {
        totalPickups,
        totalKm,
        totalCommission,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
    },
  };
});
