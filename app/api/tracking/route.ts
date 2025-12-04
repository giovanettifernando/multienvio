import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import type { TrackingEventType } from '@/types/tracking';

/**
 * Determina o status geral do envio baseado nos eventos
 */
function determineStatus(events: Array<{ type: string }>): TrackingEventType {
  if (events.length === 0) return 'CREATED';

  // O evento mais recente define o status
  const latestType = events[0].type as TrackingEventType;

  // Mapear tipos conhecidos
  const validTypes: TrackingEventType[] = [
    'CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
    'DELIVERED', 'DELAYED', 'ISSUE'
  ];

  if (validTypes.includes(latestType)) {
    return latestType;
  }

  // Fallback para tipos não mapeados
  return 'IN_TRANSIT';
}

/**
 * GET /api/tracking?shipmentId=xxx
 * Retorna eventos de rastreamento de um envio (autenticado)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shipmentId = searchParams.get('shipmentId');

    if (!shipmentId) {
      return NextResponse.json(
        { message: 'shipmentId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o shipment existe e pertence ao usuário
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
      return NextResponse.json({ message: 'Envio não encontrado' }, { status: 404 });
    }

    if (shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Determinar status baseado nos eventos
    const status = determineStatus(shipment.trackingEvents);

    // Mapear eventos para o formato esperado pelo frontend
    const events = shipment.trackingEvents.map((event) => ({
      id: event.id,
      type: event.type as TrackingEventType,
      description: event.description,
      city: event.city,
      uf: event.uf,
      occurredAt: event.occurredAt.toISOString(),
    }));

    return NextResponse.json({
      shipmentId: shipment.id,
      status,
      events,
    });
  } catch (error) {
    console.error('[TRACKING_GET]', error);
    return NextResponse.json({ message: 'Erro ao buscar rastreamento' }, { status: 500 });
  }
}
