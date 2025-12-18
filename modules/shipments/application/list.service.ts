/**
 * Shipments List Service
 *
 * Gerencia listagem de shipments do usuário com filtros e paginação.
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import type { PrismaClient, Prisma } from '@prisma/client';
import { ShipmentStatus } from './shipment-status';
import { mapToUIStatus, getBackendStatusesForUIFilter, type UIShipmentStatus } from './status-labels-map';

// =============================================================================
// Types & DTOs
// =============================================================================

export interface ShipmentListItem {
  id: string;
  trackingCode: string;
  recipientName: string | null;
  recipientCityUf: string | null;
  carrierName: string;
  serviceName: string;
  etaDays: number;
  expectedDeliveryDate: string | null | undefined;
  freightValue: number;
  status: UIShipmentStatus;
  createdAt: string;
  labelUrl: string | undefined;
  trackingUrl: string | undefined;
  hasVolumeDivergence: boolean;
  pickupRequest: {
    id: string;
    status: string;
  } | null;
}

export interface ShipmentListFilters {
  q?: string;
  status?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ShipmentListServiceDeps {
  prisma: PrismaClient | any;
}

const defaultDeps: ShipmentListServiceDeps = {
  prisma: defaultPrisma,
};

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Lista shipments do usuário com filtros e paginação.
 */
export async function listUserShipments(
  userId: string,
  filters: ShipmentListFilters,
  pagination: PaginationOptions,
  deps: ShipmentListServiceDeps = defaultDeps
): Promise<PaginatedResult<ShipmentListItem>> {
  const { prisma } = deps;
  const { q, status: statusParam } = filters;
  const { page, limit } = pagination;

  // Base filter: user's shipments with volumes
  const where: Prisma.ShipmentWhereInput = {
    senderId: userId,
    packages: {
      some: {},
    },
  };

  // Text search filter
  if (q) {
    where.OR = [
      { platformTrackingCode: { contains: q, mode: 'insensitive' } },
      { recipientName: { contains: q, mode: 'insensitive' } },
      { destinationCity: { contains: q, mode: 'insensitive' } },
      { carrier: { contains: q, mode: 'insensitive' } },
      { service: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Status filter
  if (statusParam && statusParam !== 'Todos') {
    const backendStatuses = getBackendStatusesForUIFilter(statusParam as UIShipmentStatus);
    if (backendStatuses.length > 0) {
      where.status = { in: backendStatuses };
    }
  }

  const skip = (page - 1) * limit;

  const [total, shipments] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.findMany({
      where,
      include: {
        label: true,
        pickupRequest: true,
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
    }),
  ]);

  const items = mapShipmentsToListItems(shipments);
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Maps database shipments to list DTOs.
 */
export function mapShipmentsToListItems(shipments: any[]): ShipmentListItem[] {
  return shipments.map((s) => {
    const hasVolumeDivergence = s.packages.some((pkg: { hasDivergence: boolean }) => pkg.hasDivergence);

    return {
      id: s.id,
      trackingCode: s.platformTrackingCode,
      recipientName: s.recipientName || null,
      recipientCityUf: s.destinationCity && s.destinationState
        ? `${s.destinationCity}/${s.destinationState}`
        : null,
      carrierName: s.carrier || 'Não informado',
      serviceName: s.service || 'Não informado',
      etaDays: s.estimatedDays || 0,
      expectedDeliveryDate: s.deliveredAt
        ? null
        : (s.estimatedDays ? new Date(s.createdAt.getTime() + s.estimatedDays * 24 * 60 * 60 * 1000).toISOString() : undefined),
      freightValue: s.freightCost || 0,
      status: mapToUIStatus(s.status as ShipmentStatus),
      createdAt: s.createdAt.toISOString(),
      labelUrl: s.label?.fileUrl || (s.label?.fileBase64 ? `data:${s.label.contentType};base64,${s.label.fileBase64}` : undefined),
      trackingUrl: s.publicTrackingId ? `/rastreio/${s.publicTrackingId}` : undefined,
      hasVolumeDivergence,
      pickupRequest: s.pickupRequest ? {
        id: s.pickupRequest.id,
        status: s.pickupRequest.status,
      } : null,
    };
  });
}
