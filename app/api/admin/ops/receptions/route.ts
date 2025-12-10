/**
 * GET /api/admin/ops/receptions
 *
 * Lista a fila de envios nos pontos de coleta.
 * Mostra shipments que têm pickupPointId definido e estão nos status relevantes.
 *
 * Parâmetros:
 * - page: Número da página (default: 1)
 * - pageSize: Itens por página (default: 20)
 * - status: Filtro por status (AWAITING_DROP_OFF_AT_POINT, DROPPED_OFF_AT_POINT, RECEIVED_AT_POINT, AWAITING_CARRIER_PICKUP_AT_POINT, COLLECTED_FROM_POINT, all)
 * - pickupPointId: Filtro por ponto de coleta
 * - dateStart, dateEnd: Filtro por período
 * - q: Busca textual (código de rastreio, nome do remetente/destinatário)
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

interface ReceptionPickupPoint {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

interface ReceptionSender {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
}

interface ReceptionItem {
  id: string;
  status: string;
  trackingCode: string;
  carrierTrackingCode: string | null;
  carrier: string | null;
  service: string | null;
  senderName: string | null;
  recipientName: string | null;
  weight: number;
  declaredValue: number;
  originCep: string;
  destinationCity: string;
  destinationState: string;
  pickupFee: number | null;
  receivedAt: string | null;
  receivedBy: string | null;
  createdAt: string;
  updatedAt: string;
  pickupPoint: ReceptionPickupPoint | null;
  sender: ReceptionSender | null;
}

interface ReceptionsResponse {
  items: ReceptionItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: {
    total: number;
    totalCommission: number;
    byStatus: Record<string, number>;
  };
}

// Status relevantes para fila de pontos de coleta
const POC_QUEUE_STATUSES = [
  'AWAITING_DROP_OFF_AT_POINT',
  'DROPPED_OFF_AT_POINT',
  'RECEIVED_AT_POINT',
  'AWAITING_CARRIER_PICKUP_AT_POINT',
  'COLLECTED_FROM_POINT',
];

const STATUS_ORDER: Record<string, number> = {
  AWAITING_DROP_OFF_AT_POINT: 1,
  DROPPED_OFF_AT_POINT: 2,
  RECEIVED_AT_POINT: 3,
  AWAITING_CARRIER_PICKUP_AT_POINT: 4,
  COLLECTED_FROM_POINT: 5,
};

export const GET = withApiHandler<ReceptionsResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const searchParams = new URL(req.url).searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const status = searchParams.get('status');
  const pickupPointId = searchParams.get('pickupPointId');
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');
  const q = searchParams.get('q');

  const where: Prisma.ShipmentWhereInput = {
    pickupPointId: { not: null },
  };

  // Filtro por status
  if (status && status !== 'all') {
    where.status = status;
  } else {
    // Por padrão, mostrar apenas os status da fila do PoC
    where.status = { in: POC_QUEUE_STATUSES };
  }

  // Filtro por ponto de coleta
  if (pickupPointId && pickupPointId !== 'all') {
    where.pickupPointId = pickupPointId;
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
      { platformTrackingCode: { contains: q, mode: 'insensitive' } },
      { carrierTrackingCode: { contains: q, mode: 'insensitive' } },
      { recipientName: { contains: q, mode: 'insensitive' } },
      { sender: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.shipment.count({ where }),
  ]);

  // Buscar pontos de coleta para enriquecer os dados
  const pickupPointIds = [...new Set(shipments.map(s => s.pickupPointId).filter(Boolean))] as string[];
  const pickupPoints = pickupPointIds.length > 0
    ? await prisma.pickupPoint.findMany({
        where: { id: { in: pickupPointIds } },
        select: {
          id: true,
          nomeFantasia: true,
          cidade: true,
          uf: true,
        },
      })
    : [];

  const pickupPointMap = new Map(pickupPoints.map(p => [p.id, p]));

  // Calcular resumo por status
  const statusSummary = await prisma.shipment.groupBy({
    by: ['status'],
    where: {
      pickupPointId: { not: null },
      status: { in: POC_QUEUE_STATUSES },
      ...(dateStart || dateEnd ? { createdAt: where.createdAt } : {}),
    },
    _count: true,
  });

  // Calcular total de comissões (pickupFee dos pontos)
  const commissionTotal = await prisma.shipment.aggregate({
    where: {
      pickupPointId: { not: null },
      status: { in: POC_QUEUE_STATUSES },
    },
    _sum: {
      pickupFee: true,
    },
  });

  const summary = {
    total,
    totalCommission: commissionTotal._sum.pickupFee || 0,
    byStatus: statusSummary.reduce(
      (acc, s) => {
        acc[s.status] = s._count;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  // Ordenar por prioridade de status
  const sortedShipments = shipments.sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] || 99;
    const orderB = STATUS_ORDER[b.status] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    data: {
      items: sortedShipments.map((shipment) => {
        const pickupPoint = shipment.pickupPointId ? pickupPointMap.get(shipment.pickupPointId) : null;
        return {
          id: shipment.id,
          status: shipment.status,
          trackingCode: shipment.platformTrackingCode,
          carrierTrackingCode: shipment.carrierTrackingCode,
          carrier: shipment.carrier,
          service: shipment.service,
          senderName: shipment.sender?.name || null,
          recipientName: shipment.recipientName,
          weight: shipment.weight,
          declaredValue: shipment.declaredValue,
          originCep: shipment.originCep,
          destinationCity: shipment.destinationCity,
          destinationState: shipment.destinationState,
          pickupFee: shipment.pickupFee,
          receivedAt: shipment.receivedAt?.toISOString() || null,
          receivedBy: shipment.receivedBy,
          createdAt: shipment.createdAt.toISOString(),
          updatedAt: shipment.updatedAt.toISOString(),
          pickupPoint: pickupPoint
            ? {
                id: pickupPoint.id,
                name: pickupPoint.nomeFantasia,
                city: pickupPoint.cidade,
                state: pickupPoint.uf,
              }
            : null,
          sender: shipment.sender
            ? {
                id: shipment.sender.id,
                name: shipment.sender.name,
                email: shipment.sender.email,
                phone: shipment.sender.phone,
              }
            : null,
        };
      }),
      page,
      pageSize,
      total,
      summary,
    },
  };
});
