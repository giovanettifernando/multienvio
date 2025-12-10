import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth/session';
import { updatePickupRequestSchema } from '@/lib/validation/pickup';

interface UpdatePickupResponse {
  message: string;
  pickupRequest: {
    id: string;
    status: string;
    windowStart: string | null;
    windowEnd: string | null;
    notes: string | null;
    updatedAt: string;
  };
}

/**
 * PATCH /api/coletas/[id]
 * Atualiza uma pickup request
 */
export const PATCH = withApiHandler<UpdatePickupResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const id = context.params.id;
  const body = await context.req.json();

  // Validação com Zod
  const validation = updatePickupRequestSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const { status, windowStart, windowEnd, notes } = validation.data;

  // Verificar se a pickup request existe e pertence ao usuário
  const pickupRequest = await prisma.pickupRequest.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!pickupRequest) {
    throw new ApiError({ code: 'not_found', message: 'Coleta não encontrada', status: 404 });
  }

  if (pickupRequest.userId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  // Atualizar pickup request
  const updated = await prisma.pickupRequest.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(windowStart !== undefined && { windowStart: windowStart ? new Date(windowStart) : null }),
      ...(windowEnd !== undefined && { windowEnd: windowEnd ? new Date(windowEnd) : null }),
      ...(notes !== undefined && { notes }),
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
      message: 'Coleta atualizada com sucesso',
      pickupRequest: {
        id: updated.id,
        status: updated.status,
        windowStart: updated.windowStart?.toISOString() ?? null,
        windowEnd: updated.windowEnd?.toISOString() ?? null,
        notes: updated.notes,
        updatedAt: updated.updatedAt.toISOString(),
      },
    },
  };
});

interface GetPickupResponse {
  id: string;
  companyId: string | null;
  userId: string;
  shipmentId: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  scheduleAt: string | null;
  status: string;
  notes: string | null;
  attemptCount: number;
  attemptNotes: string[];
  collectedAt: string | null;
  collectedBy: string | null;
  createdAt: string;
  updatedAt: string;
  shipment: {
    id: string;
    platformTrackingCode: string;
    carrier: string | null;
    service: string | null;
    originCep: string;
    destinationCep: string;
    recipientName: string | null;
  };
  collector: {
    id: string;
    name: string;
  } | null;
}

/**
 * GET /api/coletas/[id]
 * Retorna uma pickup request específica com dados completos
 */
export const GET = withApiHandler<GetPickupResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const id = context.params.id;

  const pickupRequest = await prisma.pickupRequest.findUnique({
    where: { id },
    include: {
      shipment: {
        select: {
          id: true,
          platformTrackingCode: true,
          carrier: true,
          service: true,
          originCep: true,
          destinationCep: true,
          recipientName: true,
        },
      },
      collector: {
        select: {
          id: true,
          pfNome: true,
        },
      },
    },
  });

  if (!pickupRequest) {
    throw new ApiError({ code: 'not_found', message: 'Coleta não encontrada', status: 404 });
  }

  if (pickupRequest.userId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  // Map collector.pfNome to name for frontend compatibility
  const collectorData = pickupRequest.collector
    ? { id: pickupRequest.collector.id, name: pickupRequest.collector.pfNome }
    : null;

  const response: GetPickupResponse = {
    id: pickupRequest.id,
    companyId: pickupRequest.companyId,
    userId: pickupRequest.userId,
    shipmentId: pickupRequest.shipmentId,
    originCep: pickupRequest.originCep,
    originAddress: pickupRequest.originAddress,
    originCity: pickupRequest.originCity,
    originUf: pickupRequest.originUf,
    windowStart: pickupRequest.windowStart?.toISOString() ?? null,
    windowEnd: pickupRequest.windowEnd?.toISOString() ?? null,
    scheduleAt: pickupRequest.scheduleAt?.toISOString() ?? null,
    status: pickupRequest.status,
    notes: pickupRequest.notes,
    attemptCount: pickupRequest.attemptCount,
    attemptNotes: (pickupRequest.attemptNotes as string[]) ?? [],
    collectedAt: pickupRequest.collectedAt?.toISOString() ?? null,
    collectedBy: pickupRequest.collectedBy,
    createdAt: pickupRequest.createdAt.toISOString(),
    updatedAt: pickupRequest.updatedAt.toISOString(),
    shipment: pickupRequest.shipment,
    collector: collectorData,
  };

  return { data: response };
});
