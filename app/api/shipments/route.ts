export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

// Mapeamento de status do banco para os status da UI
const STATUS_MAP: Record<string, string> = {
  'pending_payment': 'Aguardando coleta',
  'ready_for_posting': 'Aguardando coleta',
  'posted': 'Postado',
  'in_transit': 'Em trânsito',
  'out_for_delivery': 'Em rota de entrega',
  'delivered': 'Entregue',
  'cancelled': 'Cancelado',
  'payment_failed': 'Cancelado',
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const statusParam = searchParams.get("status") ?? "Todos";

    // Buscar shipments do banco de dados
    const where: any = {
      senderId: session.userId,
    };

    // Filtro de busca por texto
    if (q) {
      where.OR = [
        { trackingCode: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        { destinationCity: { contains: q, mode: 'insensitive' } },
        { carrier: { contains: q, mode: 'insensitive' } },
        { service: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Filtro de status
    if (statusParam && statusParam !== "Todos") {
      // Converter status da UI para status do banco
      const dbStatus = Object.entries(STATUS_MAP).find(
        ([_, uiStatus]) => uiStatus === statusParam
      )?.[0];

      if (dbStatus) {
        where.status = dbStatus;
      }
    }

    const shipments = await prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100, // Limitar resultados
    });

    // Mapear para o formato esperado pela UI
    const items = shipments.map((s) => ({
      id: s.id,
      trackingCode: s.trackingCode,
      recipientName: s.recipientName || 'Não informado',
      recipientCityUf: s.destinationCity && s.destinationState
        ? `${s.destinationCity}/${s.destinationState}`
        : 'Não informado',
      carrierName: s.carrier || 'Não informado',
      serviceName: s.service || 'Não informado',
      etaDays: s.estimatedDays || 0,
      expectedDeliveryDate: s.deliveredAt?.toISOString() || undefined,
      freightValue: s.freightCost || 0,
      status: STATUS_MAP[s.status] || s.status,
      createdAt: s.createdAt.toISOString(),
      labelUrl: undefined, // TODO: implementar geração de etiquetas
      trackingUrl: undefined, // TODO: implementar URL de rastreamento
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[SHIPMENTS_LIST]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar envios' },
      { status: 500 }
    );
  }
}

// POST /api/shipments foi movido para /api/checkout
// A criação de shipments agora é feita através do fluxo de checkout
