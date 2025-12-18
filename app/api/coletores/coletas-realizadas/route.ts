import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { getAutonomousCollectorSession } from '@/modules/auth/application/autonomous-collector-session';
import { Prisma } from '@prisma/client';

type ColetaRealizadaItem = {
  id: string;
  userId: string;
  collectorId: string | null;
  shipmentId: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  status: string;
  derivedStatus: string;
  collectedAt: string | null;
  collectedBy: string | null;
  scannedCode: string | null;
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
    pickupFee: number | null;
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

type ColetasRealizadasListResponse = {
  items: ColetaRealizadaItem[];
  page: number;
  pageSize: number;
  total: number;
};

/**
 * GET /api/coletores/coletas-realizadas
 * Lista coletas já realizadas pelo coletor logado
 *
 * Regra de negócio:
 * - Apenas coletas onde collectedAt não é nulo (coleta foi registrada)
 * - Não inclui coletas canceladas
 *
 * Status derivados:
 * - COLLECTED: "Aguardando entrega na transportadora" (collectedAt preenchido, status COLLECTED)
 * - COMPLETED: "Concluída" (status COMPLETED - indica entregue na transportadora)
 */
export const GET = withApiHandler<ColetasRealizadasListResponse>(async (context) => {
  const { req, logger } = context;

  const session = await getAutonomousCollectorSession();
  if (!session) {
    logger.debug('coletores_coletas_realizadas_no_session');
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  logger.debug('coletores_coletas_realizadas_session', {
    coletorId: session.coletorId,
    pfNome: session.pfNome
  });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
  const search = searchParams.get('search') ?? '';
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  logger.debug('coletores_coletas_realizadas_params', {
    page,
    pageSize,
    search,
    dateFrom,
    dateTo
  });

  // Construir filtros base
  const where: Prisma.PickupRequestWhereInput = {
    collectorId: session.coletorId,
    collectedAt: {
      not: null, // Apenas coletas que foram efetivamente coletadas
    },
    status: {
      notIn: ['CANCELED', 'FAILED'], // Não trazer canceladas nem falhadas
    },
  };

  // Filtro de período (data da coleta)
  if (dateFrom || dateTo) {
    where.collectedAt = {
      not: null,
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  } else {
    // Se não informado, trazer dos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    where.collectedAt = {
      not: null,
      gte: thirtyDaysAgo,
    };
  }

  // Filtro de busca (código, remetente)
  if (search.trim()) {
    where.OR = [
      {
        shipment: {
          platformTrackingCode: {
            contains: search.trim(),
            mode: 'insensitive',
          },
        },
      },
      {
        user: {
          name: {
            contains: search.trim(),
            mode: 'insensitive',
          },
        },
      },
      {
        user: {
          phone: {
            contains: search.trim(),
            mode: 'insensitive',
          },
        },
      },
    ];
  }

  // Buscar total e pickups em paralelo para melhor performance
  const [total, pickups] = await Promise.all([
    prisma.pickupRequest.count({ where }),
    prisma.pickupRequest.findMany({
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
            pickupFee: true,
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
      orderBy: { collectedAt: 'desc' }, // Mais recentes primeiro
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  logger.debug('coletores_coletas_realizadas_total', { total });

  // Mapear para formato do frontend
  const items = pickups.map((pickup) => {
    // Endereço do remetente (fallback)
    const senderAddress = pickup.user.addresses?.[0] ?? null;

    // Determinar status derivado
    // COMPLETED = Concluída (entregue na transportadora)
    // COLLECTED = Aguardando entrega na transportadora
    const derivedStatus = pickup.status === 'COMPLETED' ? 'CONCLUIDA' : 'AGUARDANDO_ENTREGA';

    return {
      id: pickup.id,
      userId: pickup.userId,
      collectorId: pickup.collectorId,
      shipmentId: pickup.shipmentId,
      originCep: pickup.originCep,
      originAddress: pickup.originAddress,
      originCity: pickup.originCity,
      originUf: pickup.originUf,
      status: pickup.status,
      derivedStatus, // Status exibido na tela
      collectedAt: pickup.collectedAt?.toISOString() ?? null,
      collectedBy: pickup.collectedBy,
      scannedCode: pickup.scannedCode,
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
        pickupFee: pickup.shipment.pickupFee,
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
