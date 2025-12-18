/**
 * GET /api/admin/ops/pickups
 *
 * Lista todas as coletas com filtros.
 *
 * Parâmetros:
 * - page: Número da página (default: 1)
 * - pageSize: Itens por página (default: 20)
 * - status: Filtro por status (PENDING, SCHEDULED, COLLECTED, FAILED, CANCELED, COMPLETED)
 * - collectorId: Filtro por coletor
 * - dateStart, dateEnd: Filtro por período
 * - q: Busca textual (código de rastreio, endereço, cidade)
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { canAccess } from '@/modules/auth/application/permissions';
import { AdminPermission, Prisma } from '@prisma/client';
import { prisma } from '@/platform/db/db';

interface PickupCollector {
  id: string;
  name: string;
  phone: string | null;
}

interface PickupShipment {
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
  status: string;
}

interface PickupUser {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
}

interface PickupItem {
  id: string;
  status: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  scheduleAt: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  attemptCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  collector: PickupCollector | null;
  shipment: PickupShipment | null;
  user: PickupUser | null;
}

interface PickupListResponse {
  items: PickupItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: {
    total: number;
    byStatus: Record<string, number>;
  };
}

const PICKUP_STATUS_ORDER: Record<string, number> = {
  PENDING: 1,
  SCHEDULED: 2,
  COLLECTED: 3,
  COMPLETED: 4,
  FAILED: 5,
  CANCELED: 6,
};

export const GET = withApiHandler<PickupListResponse>(async (context) => {
  const session = await getAdminSessionFromRequest(context.req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const staffUser = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: { id: true, status: true, isSuperAdmin: true, permissions: true },
  });

  if (!staffUser || staffUser.status !== 'ACTIVE') {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  if (!canAccess(staffUser, AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Sem permissão para operações', status: 403 });
  }

  const searchParams = context.req.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const status = searchParams.get('status');
  const collectorId = searchParams.get('collectorId');
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');
  const q = searchParams.get('q');

  const where: Prisma.PickupRequestWhereInput = {};

  // Filtro por status
  if (status && status !== 'all') {
    where.status = status;
  }

  // Filtro por coletor
  if (collectorId) {
    where.collectorId = collectorId;
  }

  // Filtro por período
  if (dateStart || dateEnd) {
    where.createdAt = {};
    if (dateStart) {
      where.createdAt.gte = new Date(dateStart);
    }
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // Busca textual
  if (q) {
    where.OR = [
      { originAddress: { contains: q, mode: 'insensitive' } },
      { originCity: { contains: q, mode: 'insensitive' } },
      { shipment: { platformTrackingCode: { contains: q, mode: 'insensitive' } } },
      { shipment: { carrierTrackingCode: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [pickups, total] = await Promise.all([
    prisma.pickupRequest.findMany({
      where,
      include: {
        collector: {
          select: {
            id: true,
            pfNome: true,
            pjRazaoSocial: true,
            pfCelular: true,
          },
        },
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
            pickupFee: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pickupRequest.count({ where }),
  ]);

  // Calcular resumo por status
  const statusSummary = await prisma.pickupRequest.groupBy({
    by: ['status'],
    where: dateStart || dateEnd ? {
      createdAt: where.createdAt,
    } : {},
    _count: true,
  });

  const summary = {
    total,
    byStatus: statusSummary.reduce(
      (acc, s) => {
        acc[s.status] = s._count;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  // Ordenar por prioridade de status
  const sortedPickups = pickups.sort((a, b) => {
    const orderA = PICKUP_STATUS_ORDER[a.status] || 99;
    const orderB = PICKUP_STATUS_ORDER[b.status] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    data: {
      items: sortedPickups.map((pickup) => ({
        id: pickup.id,
        status: pickup.status,
        originCep: pickup.originCep,
        originAddress: pickup.originAddress,
        originCity: pickup.originCity,
        originUf: pickup.originUf,
        windowStart: pickup.windowStart?.toISOString() || null,
        windowEnd: pickup.windowEnd?.toISOString() || null,
        scheduleAt: pickup.scheduleAt?.toISOString() || null,
        collectedAt: pickup.collectedAt?.toISOString() || null,
        collectedBy: pickup.collectedBy,
        attemptCount: pickup.attemptCount,
        notes: pickup.notes,
        createdAt: pickup.createdAt.toISOString(),
        updatedAt: pickup.updatedAt.toISOString(),
        collector: pickup.collector
          ? {
              id: pickup.collector.id,
              name: pickup.collector.pjRazaoSocial || pickup.collector.pfNome || 'Sem nome',
              phone: pickup.collector.pfCelular || null,
            }
          : null,
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
              status: pickup.shipment.status,
            }
          : null,
        user: pickup.user
          ? {
              id: pickup.user.id,
              name: pickup.user.name,
              email: pickup.user.email,
              phone: pickup.user.phone,
            }
          : null,
      })),
      page,
      pageSize,
      total,
      summary,
    },
  };
});
