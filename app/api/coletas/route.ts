import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth/session';
import { createPickupRequestSchema, listPickupsQuerySchema } from '@/lib/validation/pickup';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';
import type {
  PickupRequestWithShipment,
  PickupRequestsResponse,
  PickupStatus,
} from '@/lib/types/pickup';

/**
 * GET /api/coletas
 * Lista pickup requests do usuário com filtros
 */
export const GET = withApiHandler<PickupRequestsResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);

  // Validação dos query params
  const queryValidation = listPickupsQuerySchema.safeParse({
    page: searchParams.get('page') ?? '1',
    pageSize: searchParams.get('pageSize') ?? '10',
    status: searchParams.get('status') ?? undefined,
    dateStart: searchParams.get('dateStart') ?? undefined,
    dateEnd: searchParams.get('dateEnd') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    q: searchParams.get('q') ?? undefined,
  });

  const { page, pageSize, status: statusParam, dateStart, dateEnd, city, q } = queryValidation.success
    ? queryValidation.data
    : { page: 1, pageSize: 10, status: 'PENDING,SCHEDULED', dateStart: undefined, dateEnd: undefined, city: undefined, q: '' };

  // Construir filtros
  const where: Prisma.PickupRequestWhereInput = {
    userId: session.userId,
  };

  // Filtro por status - suporta múltiplos status separados por vírgula
  const statusFilter = statusParam ?? 'PENDING,SCHEDULED';
  if (statusFilter !== 'all') {
    const statuses = statusFilter.split(',').map(s => s.trim()) as PickupStatus[];
    if (statuses.length === 1) {
      where.status = statuses[0];
    } else {
      where.status = { in: statuses };
    }
  }

  // Filtro por cidade
  if (city) {
    where.originCity = { contains: city, mode: 'insensitive' };
  }

  // Filtro por data
  if (dateStart || dateEnd) {
    where.createdAt = {};
    if (dateStart) {
      where.createdAt.gte = new Date(dateStart);
    }
    if (dateEnd) {
      where.createdAt.lte = new Date(dateEnd);
    }
  }

  // Busca por tracking code ou CEP
  if (q && q.trim().length > 0) {
    where.OR = [
      { originCep: { contains: q, mode: 'insensitive' } },
      { shipment: { platformTrackingCode: { contains: q, mode: 'insensitive' } } },
    ];
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
        },
      },
      collector: {
        select: {
          id: true,
          pfNome: true,
        },
      },
    },
    orderBy: [
      { scheduleAt: { sort: 'asc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Mapear para formato do frontend
  const items: PickupRequestWithShipment[] = pickups.map((pickup) => ({
    id: pickup.id,
    companyId: pickup.companyId,
    userId: pickup.userId,
    collectorId: pickup.collectorId,
    shipmentId: pickup.shipmentId,
    originCep: pickup.originCep,
    originAddress: pickup.originAddress,
    originCity: pickup.originCity,
    originUf: pickup.originUf,
    windowStart: pickup.windowStart?.toISOString() ?? null,
    windowEnd: pickup.windowEnd?.toISOString() ?? null,
    status: pickup.status as PickupStatus,
    notes: pickup.notes,
    scheduleAt: pickup.scheduleAt?.toISOString() ?? null,
    attemptCount: pickup.attemptCount,
    createdAt: pickup.createdAt.toISOString(),
    updatedAt: pickup.updatedAt.toISOString(),
    shipment: {
      id: pickup.shipment.id,
      trackingCode: pickup.shipment.platformTrackingCode,
      carrier: pickup.shipment.carrier,
      service: pickup.shipment.service,
    },
    collector: pickup.collector ? {
      id: pickup.collector.id,
      name: pickup.collector.pfNome,
    } : null,
  }));

  const response: PickupRequestsResponse = {
    items,
    page,
    pageSize,
    total,
  };

  return { data: response };
});

interface CreatePickupResponse {
  message: string;
  pickupRequest: {
    id: string;
    status: string;
    shipmentId: string;
    originCep: string;
    createdAt: string;
  };
}

/**
 * POST /api/coletas
 * Cria uma nova pickup request
 */
export const POST = withApiHandler<CreatePickupResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const body = await context.req.json();

  // Validação com Zod
  const validation = createPickupRequestSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'coletas_validation_error', errors: validation.error.flatten() }, 'Validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const { shipmentId, windowStart, windowEnd, notes } = validation.data;

  // Verificar se o shipment existe e pertence ao usuário
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      senderId: true,
      originCep: true,
      pickupRequest: true,
    },
  });

  if (!shipment) {
    throw new ApiError({ code: 'not_found', message: 'Envio não encontrado', status: 404 });
  }

  if (shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  // Idempotência: verificar se já existe pickup request para este shipment
  if (shipment.pickupRequest) {
    throw new ApiError({
      code: 'conflict',
      message: 'Já existe uma coleta para este envio',
      status: 409,
      details: {
        pickupRequestId: shipment.pickupRequest.id,
        status: shipment.pickupRequest.status,
      },
    });
  }

  // Criar pickup request
  const pickupRequest = await prisma.pickupRequest.create({
    data: {
      userId: session.userId,
      shipmentId,
      originCep: shipment.originCep,
      originAddress: null,
      originCity: null,
      originUf: null,
      windowStart: windowStart ? new Date(windowStart) : null,
      windowEnd: windowEnd ? new Date(windowEnd) : null,
      notes,
      status: 'PENDING',
    },
    include: {
      shipment: {
        select: {
          id: true,
          platformTrackingCode: true,
          carrier: true,
          service: true,
        },
      },
    },
  });

  return {
    data: {
      message: 'Coleta criada com sucesso',
      pickupRequest: {
        id: pickupRequest.id,
        status: pickupRequest.status,
        shipmentId: pickupRequest.shipmentId,
        originCep: pickupRequest.originCep,
        createdAt: pickupRequest.createdAt.toISOString(),
      },
    },
    status: 201,
  };
});
