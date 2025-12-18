import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';

interface PendingPickupShipmentItem {
  id: string;
  trackingCode: string | null;
  pickupPointName: string;
  pickupPointCity: string;
  pickupPointState: string;
  pickupPointAddress: string;
  status: string;
  createdAt: string;
  labelStatus?: string | null;
}

interface PendingPickupShipmentsResponse {
  items: PendingPickupShipmentItem[];
  total: number;
  hasMore: boolean;
}

/**
 * GET /api/dashboard/pending-pickup-shipments
 * Retorna envios aguardando postagem em pontos de coleta
 * (shipments que não tem coleta e estão esperando entrada no ponto)
 */
export const GET = withApiHandler<PendingPickupShipmentsResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);
  const limit = parseInt(searchParams.get("limit") ?? "5", 10);

  // Buscar envios aguardando postagem em pontos de coleta
  // - Tem ponto de coleta associado
  // - Status: aguardando entrega no ponto
  // - NÃO tem pickup request (coleta)
  const shipments = await prisma.shipment.findMany({
    where: {
      senderId: session.userId,
      pickupPointId: { not: null }, // Tem ponto de coleta associado
      status: {
        in: [
          ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
          ShipmentStatus.DROPPED_OFF_AT_POINT,
          ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
        ],
      },
      pickupRequest: null, // NÃO tem coleta agendada
    },
    include: {
      label: {
        select: {
          status: true,
        },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
    take: limit + 1, // Pegar um a mais para saber se há mais resultados
  });

  // Buscar informações dos pontos de coleta
  const pickupPointIds = [...new Set(shipments.map(s => s.pickupPointId).filter(Boolean))] as string[];
  const pickupPoints = await prisma.pickupPoint.findMany({
    where: {
      id: { in: pickupPointIds },
    },
    select: {
      id: true,
      nomeFantasia: true,
      cidade: true,
      uf: true,
      logradouro: true,
      numero: true,
      bairro: true,
    },
  });
  const pickupPointsMap = new Map(pickupPoints.map(p => [p.id, p]));

  // Verificar se há mais resultados
  const hasMore = shipments.length > limit;
  const items = shipments.slice(0, limit);

  // Contar total de envios aguardando postagem
  const total = await prisma.shipment.count({
    where: {
      senderId: session.userId,
      pickupPointId: { not: null },
      status: {
        in: [
          ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
          ShipmentStatus.DROPPED_OFF_AT_POINT,
          ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
        ],
      },
      pickupRequest: null,
    },
  });

  // Mapear para o formato esperado
  const data = items.map((shipment) => {
    const pickupPoint = pickupPointsMap.get(shipment.pickupPointId!);
    const address = pickupPoint
      ? [pickupPoint.logradouro, pickupPoint.numero, pickupPoint.bairro].filter(Boolean).join(', ')
      : '';
    return {
      id: shipment.id,
      trackingCode: shipment.platformTrackingCode,
      pickupPointName: pickupPoint?.nomeFantasia || 'Ponto de coleta',
      pickupPointCity: pickupPoint?.cidade || '',
      pickupPointState: pickupPoint?.uf || '',
      pickupPointAddress: address,
      status: shipment.status,
      createdAt: shipment.createdAt.toISOString(),
      labelStatus: shipment.label?.status,
    };
  });

  return {
    data: {
      items: data,
      total,
      hasMore,
    },
  };
});
