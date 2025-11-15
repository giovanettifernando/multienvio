export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/public/track/[code]
 * Public tracking endpoint - no authentication required
 * Returns sanitized shipment data with tracking events
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code) {
      return NextResponse.json(
        { code: 'INVALID_CODE', message: 'Código de rastreamento inválido' },
        { status: 400 }
      );
    }

    // Buscar shipment pelo publicTrackingId
    const shipment = await prisma.shipment.findFirst({
      where: { publicTrackingId: code },
      select: {
        id: true,
        platformTrackingCode: true,
        status: true,
        carrier: true,
        service: true,
        originCep: true,
        destinationCep: true,
        destinationCity: true,
        destinationState: true,
        estimatedDays: true,
        freightCost: true,
        declaredValue: true,
        weight: true,
        postedAt: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
        // Relacionamento com eventos
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
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Envio não encontrado' },
        { status: 404 }
      );
    }

    // Sanitizar dados - não retornar informações sensíveis
    const sanitizedData = {
      trackingCode: shipment.platformTrackingCode, // Expor apenas código da plataforma
      status: shipment.status,
      carrier: shipment.carrier || 'Não informado',
      service: shipment.service || 'Não informado',
      origin: {
        cep: shipment.originCep,
      },
      destination: {
        cep: shipment.destinationCep,
        city: shipment.destinationCity,
        state: shipment.destinationState,
      },
      estimatedDays: shipment.estimatedDays,
      freightCost: shipment.freightCost,
      declaredValue: shipment.declaredValue,
      weight: shipment.weight,
      postedAt: shipment.postedAt?.toISOString(),
      deliveredAt: shipment.deliveredAt?.toISOString(),
      createdAt: shipment.createdAt.toISOString(),
      // Eventos de rastreamento
      events: shipment.trackingEvents.map((event) => ({
        type: event.type,
        description: event.description,
        city: event.city,
        uf: event.uf,
        occurredAt: event.occurredAt.toISOString(),
      })),
    };

    return NextResponse.json(sanitizedData);
  } catch (error) {
    console.error('[PUBLIC_TRACK_GET]', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Erro ao buscar rastreamento' },
      { status: 500 }
    );
  }
}
