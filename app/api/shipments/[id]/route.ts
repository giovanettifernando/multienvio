export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * GET /api/shipments/:id
 * Retorna detalhes completos do shipment por ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id: shipmentId } = await params;

    console.debug('[DETAIL] params.id=', shipmentId);

    // Buscar shipment por ID (escopo do usuário)
    const shipment = await prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        senderId: session.userId, // Verificar que pertence ao usuário
      },
      include: {
        trackingEvents: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Envio não encontrado' },
        { status: 404 }
      );
    }

    // Retornar snapshot completo do shipment
    return NextResponse.json({
      id: shipment.id,
      trackingCode: shipment.platformTrackingCode, // Expor apenas código da plataforma
      publicTrackingId: shipment.publicTrackingId,
      status: shipment.status,
      paymentMethod: shipment.paymentMethod,
      carrier: shipment.carrier,
      service: shipment.service,
      freightCost: shipment.freightCost,
      estimatedDays: shipment.estimatedDays,
      declaredValue: shipment.declaredValue,
      weight: shipment.weight,
      originCep: shipment.originCep,
      destinationCep: shipment.destinationCep,
      destinationCity: shipment.destinationCity,
      destinationState: shipment.destinationState,
      destinationAddress: shipment.destinationAddress,
      destinationNeighborhood: shipment.destinationNeighborhood,
      recipientName: shipment.recipientName,
      recipientPhone: shipment.recipientPhone,
      recipientEmail: shipment.recipientEmail,
      recipientDocument: shipment.recipientDocument,
      pickupPointId: shipment.pickupPointId,
      document: shipment.document, // Snapshot completo (originAddress, destination, volumes, preferences, etc)
      postedAt: shipment.postedAt,
      deliveredAt: shipment.deliveredAt,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
      // Eventos de rastreamento
      trackingEvents: shipment.trackingEvents.map((event) => ({
        type: event.type,
        description: event.description,
        city: event.city,
        uf: event.uf,
        occurredAt: event.occurredAt.toISOString(),
      })),
    });

  } catch (error) {
    console.error('[SHIPMENT_GET]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar envio' },
      { status: 500 }
    );
  }
}
