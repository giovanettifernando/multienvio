/**
 * API Route para recepção de envios no hub do coletor
 * GET /api/pontos-coleta/receptions - Lista envios pendentes de recepção
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';

type PackageInfo = {
  id: string;
  packageNumber: number;
  width: number;
  height: number;
  length: number;
  weight: number;
  hasDivergence: boolean;
  divergenceType: string | null;
  divergenceNotes: string | null;
  divergenceWidth: number | null;
  divergenceHeight: number | null;
  divergenceLength: number | null;
  divergenceWeight: number | null;
  checkedAt: string | null;
  checkedBy: string | null;
};

type ShipmentInfo = {
  id: string;
  trackingCode: string | null;
  carrierTrackingCode: string | null;
  sender: {
    name: string;
    phone: string;
  };
  recipient: {
    name: string;
  };
  destination: string;
  destinationCity: string;
  destinationState: string;
  weight: number;
  status: string;
  postedAt: string | null;
  packages: PackageInfo[];
};

type ReceptionsListResponse = {
  shipments: ShipmentInfo[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

/**
 * GET /api/pontos-coleta/receptions
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
export const GET = withApiHandler<ReceptionsListResponse>(async ({ req }) => {
  // SECURITY: Requer autenticação de ponto de coleta
  const session = await getCollectorSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autenticado', status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const search = searchParams.get('search') || '';

  const skip = (page - 1) * pageSize;

  // Status considerados "pendentes de recepção" (novos status padronizados)
  const pendingReceptionStatuses = [
    // Fase A - Origem (Coleta)
    ShipmentStatus.COLLECTED_FROM_SENDER,
    ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
    // Fase A - Origem (Ponto de Coleta)
    ShipmentStatus.DROPPED_OFF_AT_POINT,
    ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
    ShipmentStatus.COLLECTED_FROM_POINT,
    // Fase B - Transporte
    ShipmentStatus.IN_TRANSFER,
    ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
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
      postedAt: shipment.postedAt?.toISOString() ?? null,
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
        checkedAt: pkg.checkedAt?.toISOString() ?? null,
        checkedBy: pkg.checkedBy,
      })),
    };
  });

  return {
    data: {
      shipments: shipmentsFormatted,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  };
});
