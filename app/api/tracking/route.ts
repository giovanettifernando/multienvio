import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';
import type { TrackingEventType, Tracking } from '@/shared/types/tracking';

/**
 * Determina o status geral do envio baseado nos eventos
 */
function determineStatus(events: Array<{ type: string }>): TrackingEventType {
  if (events.length === 0) return 'CREATED';

  const latestType = events[0].type as TrackingEventType;

  const validTypes: TrackingEventType[] = [
    'CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
    'DELIVERED', 'DELAYED', 'ISSUE'
  ];

  if (validTypes.includes(latestType)) {
    return latestType;
  }

  return 'IN_TRANSIT';
}

/**
 * GET /api/tracking?shipmentId=xxx
 * Retorna eventos de rastreamento de um envio (autenticado)
 */
export const GET = withApiHandler<Tracking>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);
  const shipmentId = searchParams.get('shipmentId');

  if (!shipmentId) {
    throw new ApiError({ code: 'validation_error', message: 'shipmentId é obrigatório', status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      senderId: true,
      status: true,
      trackingEvents: {
        select: {
          id: true,
          type: true,
          description: true,
          city: true,
          uf: true,
          occurredAt: true,
        },
        orderBy: {
          occurredAt: 'desc',
        },
      },
    },
  });

  if (!shipment) {
    throw new ApiError({ code: 'not_found', message: 'Envio não encontrado', status: 404 });
  }

  if (shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  const status = determineStatus(shipment.trackingEvents);

  const events = shipment.trackingEvents.map((event) => ({
    id: event.id,
    type: event.type as TrackingEventType,
    description: event.description,
    city: event.city ?? undefined,
    uf: event.uf ?? undefined,
    occurredAt: event.occurredAt.toISOString(),
  }));

  return {
    data: {
      shipmentId: shipment.id,
      status,
      events,
    },
  };
});
