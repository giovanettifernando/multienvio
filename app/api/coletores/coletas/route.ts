import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';

type PickupItemResponse = {
  id: string;
  userId: string;
  collectorId: string | null;
  shipmentId: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  status: string;
  notes: string | null;
  scheduleAt: string | null;
  attemptCount: number;
  attemptNotes: unknown;
  createdAt: string;
  updatedAt: string;
  shipment: {
    id: string;
    trackingCode: string | null;
    carrier: string | null;
    service: string | null;
    weight: number | null;
    declaredValue: number | null;
    recipientName: string | null;
    destinationCity: string | null;
    destinationState: string | null;
    originCep: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
  senderAddress: {
    id: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
  } | null;
};

type ColetasListResponse = {
  items: PickupItemResponse[];
  page: number;
  pageSize: number;
  total: number;
};

/**
 * GET /api/coletores/coletas
 * Lista pickup requests pendentes atribuídas ao coletor logado
 */
export const GET = withApiHandler<ColetasListResponse>(async (context) => {
  const { req, logger } = context;

  const session = await getAutonomousCollectorSession();
  if (!session) {
    logger.debug('coletores_coletas_no_session');
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  logger.debug('coletores_coletas_session', { coletorId: session.coletorId });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
  const statusParam = searchParams.get('status') ?? 'PENDING,SCHEDULED';

  // Construir filtros
  const where: {
    collectorId: string;
    status?: string | { in: string[] };
  } = {
    collectorId: session.coletorId,
  };

  // Filtro por status - suporta múltiplos status separados por vírgula
  if (statusParam && statusParam !== 'all') {
    const statuses = statusParam.split(',').map(s => s.trim());
    if (statuses.length === 1) {
      where.status = statuses[0];
    } else {
      where.status = { in: statuses };
    }
  }

  // Contar total
  const total = await prisma.pickupRequest.count({ where });

  // Buscar pickup requests
  const pickups = await prisma.pickupRequest.findMany({
    where,
    include: {
      shipment: {
        select: {
          id: true,
          platformTrackingCode: true,
          carrier: true,
          service: true,
          weight: true,
          declaredValue: true,
          recipientName: true,
          destinationCity: true,
          destinationState: true,
          originCep: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          addresses: {
            where: { isDefault: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Mapear para formato do frontend
  const items = pickups.map((pickup) => {
    // Endereço do remetente (fallback)
    const senderAddress = pickup.user.addresses?.[0] ?? null;

    return {
      id: pickup.id,
      userId: pickup.userId,
      collectorId: pickup.collectorId,
      shipmentId: pickup.shipmentId,
      originCep: pickup.originCep,
      originAddress: pickup.originAddress,
      originCity: pickup.originCity,
      originUf: pickup.originUf,
      windowStart: pickup.windowStart?.toISOString() ?? null,
      windowEnd: pickup.windowEnd?.toISOString() ?? null,
      status: pickup.status,
      notes: pickup.notes,
      scheduleAt: pickup.scheduleAt?.toISOString() ?? null,
      attemptCount: pickup.attemptCount,
      attemptNotes: pickup.attemptNotes,
      createdAt: pickup.createdAt.toISOString(),
      updatedAt: pickup.updatedAt.toISOString(),
      shipment: {
        id: pickup.shipment.id,
        trackingCode: pickup.shipment.platformTrackingCode,
        carrier: pickup.shipment.carrier,
        service: pickup.shipment.service,
        weight: pickup.shipment.weight,
        declaredValue: pickup.shipment.declaredValue,
        recipientName: pickup.shipment.recipientName,
        destinationCity: pickup.shipment.destinationCity,
        destinationState: pickup.shipment.destinationState,
        originCep: pickup.shipment.originCep,
      },
      user: {
        id: pickup.user.id,
        name: pickup.user.name,
        email: pickup.user.email,
        phone: pickup.user.phone,
      },
      senderAddress: senderAddress ? {
        id: senderAddress.id,
        cep: senderAddress.cep,
        logradouro: senderAddress.logradouro,
        numero: senderAddress.numero,
        complemento: senderAddress.complemento,
        bairro: senderAddress.bairro,
        cidade: senderAddress.cidade,
        uf: senderAddress.uf,
      } : null,
    };
  });

  return {
    data: {
      items,
      page,
      pageSize,
      total,
    },
  };
});
