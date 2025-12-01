
import { NextRequest, NextResponse } from "next/server";
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import { mapToUIStatus, getBackendStatusesForUIFilter, type UIShipmentStatus } from '@/lib/shipments/status-labels-map';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const statusParam = searchParams.get("status") ?? "Todos";

    // Paginação
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    // Buscar shipments do banco de dados
    const where: Prisma.ShipmentWhereInput = {
      senderId: session.userId,
      // FILTRO CRÍTICO: Apenas shipments que TÊM volumes
      packages: {
        some: {}, // Deve ter pelo menos 1 volume
      },
    };

    // Filtro de busca por texto
    if (q) {
      where.OR = [
        { platformTrackingCode: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        { destinationCity: { contains: q, mode: 'insensitive' } },
        { carrier: { contains: q, mode: 'insensitive' } },
        { service: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Filtro de status
    if (statusParam && statusParam !== "Todos") {
      // Converter status da UI para lista de status do backend
      const backendStatuses = getBackendStatusesForUIFilter(statusParam as UIShipmentStatus);

      if (backendStatuses.length > 0) {
        where.status = {
          in: backendStatuses,
        };
      }
    }

    // Calcular skip para paginação
    const skip = (page - 1) * limit;

    // Buscar total de registros (para paginação)
    const total = await prisma.shipment.count({ where });

    // Buscar shipments com paginação
    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        label: true, // Incluir dados da etiqueta
        pickupRequest: true, // Incluir dados da coleta
        packages: {
          select: {
            id: true,
            hasDivergence: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Mapear para o formato esperado pela UI
    const items = shipments.map((s) => {
      // Verificar se algum volume tem divergência
      const hasVolumeDivergence = s.packages.some((pkg) => pkg.hasDivergence);

      return {
        id: s.id,
        trackingCode: s.platformTrackingCode, // Expor apenas código da plataforma
        recipientName: s.recipientName || null,
        recipientCityUf: s.destinationCity && s.destinationState
          ? `${s.destinationCity}/${s.destinationState}`
          : null,
        carrierName: s.carrier || 'Não informado',
        serviceName: s.service || 'Não informado',
        etaDays: s.estimatedDays || 0,
        expectedDeliveryDate: s.deliveredAt
          ? null // Já foi entregue, não há previsão
          : (s.estimatedDays ? new Date(s.createdAt.getTime() + s.estimatedDays * 24 * 60 * 60 * 1000).toISOString() : undefined),
        freightValue: s.freightCost || 0,
        status: mapToUIStatus(s.status as ShipmentStatus),
        createdAt: s.createdAt.toISOString(),
        labelUrl: s.label?.fileUrl || (s.label?.fileBase64 ? `data:${s.label.contentType};base64,${s.label.fileBase64}` : undefined),
        trackingUrl: s.publicTrackingId ? `/rastreio/${s.publicTrackingId}` : undefined,
        hasVolumeDivergence, // Flag para alerta de divergência
        pickupRequest: s.pickupRequest ? {
          id: s.pickupRequest.id,
          status: s.pickupRequest.status,
        } : null,
      };
    });

    // Calcular total de páginas
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
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
