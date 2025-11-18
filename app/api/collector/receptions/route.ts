/**
 * API Route para recepção de envios no hub do coletor
 * GET /api/collector/receptions - Lista envios pendentes de recepção
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * GET /api/collector/receptions
 * Retorna envios pendentes de recepção no hub
 *
 * FONTE DE DADOS: Tabela Shipments (sem tabela separada "receptions")
 *
 * Critérios de filtro:
 * - receivedAt IS NULL (ainda não recebido no hub)
 * - Status válidos (pendentes de recepção):
 *   - "ready_for_posting": Pronto para postagem
 *   - "postado": Já postado, aguardando chegada
 *   - "em_transito": Em trânsito para o hub
 *   - "coletado": Coletado, aguardando chegada
 *   - "aguardando_recebimento": Explicitamente aguardando recebimento
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * pageSize;

    // Status considerados "pendentes de recepção"
    const pendingReceptionStatuses = [
      'awaiting_pickup', // Aguardando coleta na origem
      'awaiting_posting', // Aguardando postagem no ponto de coleta
      'ready_for_posting', // Legacy (deprecated)
      'postado',
      'em_transito',
      'coletado',
      'aguardando_recebimento',
    ];

    // Filtros: envios ainda não recebidos no hub
    const where: Prisma.ShipmentWhereInput = {
      receivedAt: null, // Ainda não recebido no hub
      // Status válidos para recepção
      status: {
        in: pendingReceptionStatuses,
      },
      // FILTRO CRÍTICO: Apenas shipments que TÊM volumes
      packages: {
        some: {}, // Deve ter pelo menos 1 volume
      },
    };

    // Filtro de busca (código de rastreio, destinatário)
    if (search.trim()) {
      where.OR = [
        { platformTrackingCode: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' }, // Ordena por data de criação
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          packages: {
            orderBy: { packageNumber: 'asc' },
          },
        },
      }),
      prisma.shipment.count({ where }),
    ]);

    /**
     * Mapeamento de campos Shipment -> Grid de Recepção:
     *
     * Shipment.id                 -> id (identificador)
     * Shipment.platformTrackingCode -> trackingCode (Código Rastreio)
     * Shipment.sender.name        -> sender.name (Remetente)
     * Shipment.sender.phone       -> sender.phone (Telefone remetente)
     * Shipment.recipientName      -> recipient.name (Destinatário)
     * Shipment.destinationCity/State -> destination (Destino)
     * SUM(packages.weight)        -> weight (Peso Total - calculado pela soma dos volumes)
     * Shipment.status             -> status (Status)
     * Shipment.packages           -> packages (Volumes - linha expansível)
     */
    const shipmentsFormatted = shipments.map((shipment) => {
      // Calcular peso total pela soma dos volumes
      // Se houver volumes, usar soma dos pesos dos volumes
      // Caso contrário, usar peso declarado do shipment
      const calculatedWeight =
        shipment.packages.length > 0
          ? shipment.packages.reduce((sum, pkg) => sum + pkg.weight, 0)
          : shipment.weight;

      // Log de aviso se houver divergência significativa (> 0.01 kg)
      if (shipment.packages.length > 0 && Math.abs(calculatedWeight - shipment.weight) > 0.01) {
        console.warn(
          `[RECEPTIONS] Divergência de peso detectada para shipment ${shipment.id}:`,
          {
            shipmentWeight: shipment.weight,
            calculatedWeight,
            difference: Math.abs(calculatedWeight - shipment.weight),
          }
        );
      }

      return {
        id: shipment.id,
        trackingCode: shipment.platformTrackingCode,
        carrierTrackingCode: shipment.carrierTrackingCode,
        sender: {
          name: shipment.sender.name,
          phone: shipment.sender.phone || '',
        },
        recipient: {
          name: shipment.recipientName || 'N/A',
        },
        destination: `${shipment.destinationCity}/${shipment.destinationState}`,
        destinationCity: shipment.destinationCity,
        destinationState: shipment.destinationState,
        weight: calculatedWeight, // Usar peso calculado
        status: shipment.status,
        postedAt: shipment.postedAt,
        packages: shipment.packages.map((pkg) => ({
          id: pkg.id,
          packageNumber: pkg.packageNumber,
          width: pkg.width,
          height: pkg.height,
          length: pkg.length,
          weight: pkg.weight,
          hasDivergence: pkg.hasDivergence,
          divergenceType: pkg.divergenceType,
          divergenceNotes: pkg.divergenceNotes,
          divergenceWidth: pkg.divergenceWidth,
          divergenceHeight: pkg.divergenceHeight,
          divergenceLength: pkg.divergenceLength,
          divergenceWeight: pkg.divergenceWeight,
          checkedAt: pkg.checkedAt,
          checkedBy: pkg.checkedBy,
        })),
      };
    });

    return NextResponse.json({
      shipments: shipmentsFormatted,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[COLLECTOR_RECEPTIONS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar envios';
    return NextResponse.json({ message }, { status: 500 });
  }
}
