/**
 * Coletas (Pickup Requests) List Service
 *
 * Gerencia listagem e criação de pickup requests do usuário.
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import { ApiError } from '@/platform/api/errors';
import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  PickupRequestWithShipment,
  PickupRequestsResponse,
  PickupStatus,
} from '@/shared/types/pickup';

// =============================================================================
// Types
// =============================================================================

export interface ColetasFilters {
  status?: string;
  dateStart?: string;
  dateEnd?: string;
  city?: string;
  q?: string;
}

export interface ColetasPagination {
  page: number;
  pageSize: number;
}

export interface CreatePickupInput {
  shipmentId: string;
  windowStart?: string;
  windowEnd?: string;
  notes?: string;
}

export interface ColetasServiceDeps {
  prisma: PrismaClient | any;
}

const defaultDeps: ColetasServiceDeps = {
  prisma: defaultPrisma,
};

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Lista pickup requests do usuário com filtros.
 */
export async function listUserPickups(
  userId: string,
  filters: ColetasFilters,
  pagination: ColetasPagination,
  deps: ColetasServiceDeps = defaultDeps
): Promise<PickupRequestsResponse> {
  const { prisma } = deps;
  const { status: statusParam, dateStart, dateEnd, city, q } = filters;
  const { page, pageSize } = pagination;

  const where: Prisma.PickupRequestWhereInput = {
    userId,
  };

  // Status filter - supports multiple comma-separated statuses
  const statusFilter = statusParam ?? 'PENDING,SCHEDULED';
  if (statusFilter !== 'all') {
    const statuses = statusFilter.split(',').map(s => s.trim()) as PickupStatus[];
    if (statuses.length === 1) {
      where.status = statuses[0];
    } else {
      where.status = { in: statuses };
    }
  }

  // City filter
  if (city) {
    where.originCity = { contains: city, mode: 'insensitive' };
  }

  // Date filter
  if (dateStart || dateEnd) {
    where.createdAt = {};
    if (dateStart) {
      where.createdAt.gte = new Date(dateStart);
    }
    if (dateEnd) {
      where.createdAt.lte = new Date(dateEnd);
    }
  }

  // Text search
  if (q && q.trim().length > 0) {
    where.OR = [
      { originCep: { contains: q, mode: 'insensitive' } },
      { shipment: { platformTrackingCode: { contains: q, mode: 'insensitive' } } },
    ];
  }

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
    }),
  ]);

  const items = mapPickupsToDTO(pickups);

  return {
    items,
    page,
    pageSize,
    total,
  };
}

/**
 * Cria uma nova pickup request.
 */
export async function createPickupRequest(
  userId: string,
  input: CreatePickupInput,
  deps: ColetasServiceDeps = defaultDeps
): Promise<{ id: string; status: string; shipmentId: string; originCep: string; createdAt: string }> {
  const { prisma } = deps;
  const { shipmentId, windowStart, windowEnd, notes } = input;

  // Verify shipment exists and belongs to user
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

  if (shipment.senderId !== userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  // Idempotency check
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

  // Create pickup request
  const pickupRequest = await prisma.pickupRequest.create({
    data: {
      userId,
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
  });

  return {
    id: pickupRequest.id,
    status: pickupRequest.status,
    shipmentId: pickupRequest.shipmentId,
    originCep: pickupRequest.originCep,
    createdAt: pickupRequest.createdAt.toISOString(),
  };
}

/**
 * Maps pickups to DTOs.
 */
export function mapPickupsToDTO(pickups: any[]): PickupRequestWithShipment[] {
  return pickups.map((pickup) => ({
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
}
