export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * GET /api/dashboard/pending-pickup-shipments
 * Retorna envios pendentes de entrega em pontos de coleta
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "5", 10);

    // Buscar envios pendentes em pontos de coleta
    const shipments = await prisma.shipment.findMany({
      where: {
        senderId: session.userId,
        pickupPointId: { not: null }, // Tem ponto de coleta associado
        status: {
          in: ['pending_payment', 'ready_for_posting'], // Aguardando entrega no ponto
        },
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
      },
    });

    const pickupPointsMap = new Map(pickupPoints.map(p => [p.id, p]));

    // Verificar se há mais resultados
    const hasMore = shipments.length > limit;
    const items = shipments.slice(0, limit);

    // Mapear para o formato esperado
    const data = items.map((shipment) => {
      const pickupPoint = pickupPointsMap.get(shipment.pickupPointId!);

      return {
        id: shipment.id,
        trackingCode: shipment.platformTrackingCode,
        pickupPointName: pickupPoint?.nomeFantasia || 'Ponto de coleta',
        pickupPointCity: pickupPoint?.cidade || '',
        pickupPointState: pickupPoint?.uf || '',
        status: shipment.status,
        createdAt: shipment.createdAt.toISOString(),
        labelStatus: shipment.label?.status,
      };
    });

    return NextResponse.json({
      items: data,
      total: items.length,
      hasMore,
    });
  } catch (error) {
    console.error('[DASHBOARD_PENDING_PICKUP_SHIPMENTS]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar envios pendentes' },
      { status: 500 }
    );
  }
}
