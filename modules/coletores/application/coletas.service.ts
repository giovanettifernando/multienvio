/**
 * Collector Pickups Service
 *
 * Gerencia listagem de coletas atribuídas ao coletor autônomo.
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import type { PrismaClient } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface CollectorPickupDto {
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
}

export interface CollectorPickupsResponse {
  items: CollectorPickupDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CollectorPickupsFilters {
  status?: string;
}

export interface CollectorPickupsPagination {
  page: number;
  pageSize: number;
}

export interface CollectorPickupsServiceDeps {
  prisma: PrismaClient | any;
}

const defaultDeps: CollectorPickupsServiceDeps = {
  prisma: defaultPrisma,
};

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Lista pickups atribuídos ao coletor.
 */
export async function listCollectorPickups(
  collectorId: string,
  filters: CollectorPickupsFilters,
  pagination: CollectorPickupsPagination,
  deps: CollectorPickupsServiceDeps = defaultDeps
): Promise<CollectorPickupsResponse> {
  const { prisma } = deps;
  const { status: statusParam } = filters;
  const { page, pageSize } = pagination;

  const where: {
    collectorId: string;
    status?: string | { in: string[] };
  } = {
    collectorId,
  };

  // Status filter - supports multiple comma-separated statuses
  const statusFilter = statusParam ?? 'PENDING,SCHEDULED';
  if (statusFilter && statusFilter !== 'all') {
    const statuses = statusFilter.split(',').map(s => s.trim());
    if (statuses.length === 1) {
      where.status = statuses[0];
    } else {
      where.status = { in: statuses };
    }
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
    }),
  ]);

  const items = mapCollectorPickupsToDTO(pickups);

  return {
    items,
    page,
    pageSize,
    total,
  };
}

/**
 * Maps pickups to collector DTOs.
 */
export function mapCollectorPickupsToDTO(pickups: any[]): CollectorPickupDto[] {
  return pickups.map((pickup) => {
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
}
