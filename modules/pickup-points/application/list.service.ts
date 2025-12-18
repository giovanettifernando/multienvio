/**
 * Pickup Points List Service
 *
 * Gerencia listagem de pontos de coleta com cache e geocoding.
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import { getCoordinatesForCep } from '@/platform/db/postgis';
import { logger as defaultLogger } from '@/platform/logging/logger';
import { cacheGetOrSet, CacheTTL } from '@/platform/cache/cache';
import type { PrismaClient } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface PickupPoint {
  id: string;
  name: string;
  alias: string;
  address: string;
  number: string;
  neighborhood: string;
  city: string;
  uf: string;
  cep: string;
  lat: number | null;
  lng: number | null;
}

export interface PickupPointFilters {
  cidade?: string;
  uf?: string;
  q?: string;
}

export interface PickupPointsServiceDeps {
  prisma: PrismaClient | any;
  logger?: typeof defaultLogger;
  cache?: {
    getOrSet: typeof cacheGetOrSet;
  };
}

const defaultDeps: PickupPointsServiceDeps = {
  prisma: defaultPrisma,
  logger: defaultLogger,
  cache: { getOrSet: cacheGetOrSet },
};

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Lista pontos de coleta ativos com filtros.
 * Usa cache para listagens por UF/cidade.
 */
export async function listPickupPoints(
  filters: PickupPointFilters,
  deps: PickupPointsServiceDeps = defaultDeps
): Promise<PickupPoint[]> {
  const { cidade, uf, q } = filters;
  const { cache } = deps;

  // Text search is not cached (too variable)
  const shouldCache = !q && cache;
  const cacheKey = shouldCache
    ? `pickup-points:${uf || 'all'}:${cidade || 'all'}`
    : null;

  if (cacheKey && cache) {
    return cache.getOrSet<PickupPoint[]>(
      cacheKey,
      () => fetchPickupPoints(filters, deps),
      CacheTTL.LONG
    );
  }

  return fetchPickupPoints(filters, deps);
}

/**
 * Fetches pickup points from database with geocoding.
 */
export async function fetchPickupPoints(
  filters: PickupPointFilters,
  deps: PickupPointsServiceDeps = defaultDeps
): Promise<PickupPoint[]> {
  const { prisma, logger } = deps;
  const { cidade, uf, q } = filters;

  const where: {
    status: 'ACTIVE' | 'BLOCKED' | 'PENDING';
    cidade?: { equals: string; mode: 'insensitive' };
    uf?: string;
    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
  } = {
    status: 'ACTIVE',
  };

  if (cidade) {
    where.cidade = {
      equals: cidade,
      mode: 'insensitive',
    };
  }

  if (uf) {
    where.uf = uf.toUpperCase();
  }

  if (q) {
    where.OR = [
      { nomeFantasia: { contains: q, mode: 'insensitive' } },
      { razaoSocial: { contains: q, mode: 'insensitive' } },
      { bairro: { contains: q, mode: 'insensitive' } },
      { cidade: { contains: q, mode: 'insensitive' } },
    ];
  }

  const pickupPoints = await prisma.pickupPoint.findMany({
    where,
    select: {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
      cep: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      uf: true,
    },
    orderBy: [
      { cidade: 'asc' },
      { nomeFantasia: 'asc' },
    ],
  });

  // Map and geocode in parallel
  const result = await Promise.all(
    pickupPoints.map(async (point: any) => {
      let lat: number | null = null;
      let lng: number | null = null;

      if (point.cep) {
        try {
          const coords = await getCoordinatesForCep(point.cep);
          lat = coords.lat;
          lng = coords.lng;
        } catch (error) {
          logger?.warn?.({ event: 'pickup_points_geocode_failed', cep: point.cep, err: error }, 'Failed to get coords for CEP');
        }
      }

      return {
        id: point.id,
        name: point.nomeFantasia,
        alias: point.razaoSocial,
        address: point.logradouro || '',
        number: point.numero || '',
        neighborhood: point.bairro || '',
        city: point.cidade || '',
        uf: point.uf || '',
        cep: point.cep || '',
        lat,
        lng,
      };
    })
  );

  return result;
}
