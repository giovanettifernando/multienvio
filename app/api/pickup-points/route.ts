import { withApiHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { getCoordinatesForCep } from '@/lib/services/postgis';
import { logger } from '@/lib/logger';

interface PickupPoint {
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

type PickupPointsListResponse = PickupPoint[];

/**
 * GET /api/pickup-points
 * Retorna pontos de coleta ativos filtrados por localização
 */
export const GET = withApiHandler<PickupPointsListResponse>(async (context) => {
  const { searchParams } = new URL(context.req.url);
  const cidade = searchParams.get('cidade');
  const uf = searchParams.get('uf');
  const q = searchParams.get('q'); // Busca por nome/bairro/cidade

  // Filtros base
  const where: {
    status: 'ACTIVE' | 'BLOCKED' | 'PENDING';
    cidade?: { equals: string; mode: 'insensitive' };
    uf?: string;
    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
  } = {
    status: 'ACTIVE',
  };

  // Filtrar por cidade/UF se fornecidos
  if (cidade) {
    where.cidade = {
      equals: cidade,
      mode: 'insensitive',
    };
  }

  if (uf) {
    where.uf = uf.toUpperCase();
  }

  // Busca textual opcional
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

  // Mapear para formato simplificado
  // Obter coordenadas dos CEPs em paralelo
  const result = await Promise.all(
    pickupPoints.map(async (point) => {
      let lat: number | null = null;
      let lng: number | null = null;

      // Obter coordenadas do CEP se disponível
      if (point.cep) {
        try {
          const coords = await getCoordinatesForCep(point.cep);
          lat = coords.lat;
          lng = coords.lng;
        } catch (error) {
          logger.warn({ event: 'pickup_points_geocode_failed', cep: point.cep, err: error }, 'Failed to get coords for CEP');
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

  return { data: result };
});
