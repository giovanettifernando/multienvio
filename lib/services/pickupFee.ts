/**
 * Serviço de cálculo de taxa de coleta na origem
 *
 * Regras:
 * - Sempre selecionar o coletor MAIS PRÓXIMO do remetente
 * - Taxa pode ser FIXED (valor fixo) ou PER_KM (valor por km)
 * - Usar cálculo de distância com Haversine
 */

import { prisma } from '@/lib/db';
import { calculateDistance, type GeoCoordinates } from '@/lib/utils/geo';
import { geocodeCEP } from '@/lib/services/geocoding';

export type PickupFeeCalculation = {
  success: true;
  collector: {
    id: string;
    nome: string;
    pfNome: string;
    pjRazaoSocial: string;
  };
  distanceKm: number;
  feeType: 'FIXED' | 'PER_KM';
  feeAmount: number; // Em reais (BRL)
  totalWithPickup: number; // Frete + taxa de coleta
} | {
  success: false;
  error: string;
};

type CollectorWithGeo = {
  id: string;
  status: string;
  pfNome: string;
  pjRazaoSocial: string;
  pfGeo: unknown;
  pjGeo: unknown;
  pickupFeeType: string;
  pickupFixedFee: number | null;
  pickupFeePerKm: number | null;
};

/**
 * Calcula taxa de coleta para uma cotação
 *
 * @param originCep - CEP de origem (remetente)
 * @param freightCost - Custo do frete em reais
 * @returns Cálculo completo da taxa de coleta ou erro
 */
export async function calculatePickupFee(
  originCep: string,
  freightCost: number
): Promise<PickupFeeCalculation> {
  try {
    // 1. Geocodificar origem
    const cleanOriginCep = originCep.replace(/\D/g, '');

    if (cleanOriginCep.length !== 8) {
      return { success: false, error: 'CEP de origem inválido' };
    }

    const geocodeResult = await geocodeCEP(cleanOriginCep);

    if (!geocodeResult.success || !geocodeResult.coordinates) {
      return {
        success: false,
        error: `Não foi possível geocodificar o CEP de origem: ${geocodeResult.error}`,
      };
    }

    const originCoords = geocodeResult.coordinates;

    // 2. Buscar todos os coletores ATIVOS com coordenadas válidas
    const collectors = await prisma.collector.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        status: true,
        pfNome: true,
        pjRazaoSocial: true,
        pfGeo: true,
        pjGeo: true,
        pickupFeeType: true,
        pickupFixedFee: true,
        pickupFeePerKm: true,
      },
    });

    if (collectors.length === 0) {
      return { success: false, error: 'Nenhum coletor ativo disponível' };
    }

    // 3. Calcular distância para cada coletor e encontrar o mais próximo
    type CollectorWithDistance = CollectorWithGeo & { distance: number; coords: GeoCoordinates };

    const collectorsWithDistance: CollectorWithDistance[] = [];

    for (const collector of collectors) {
      // Tentar coordenadas PF primeiro, depois PJ
      let collectorCoords: GeoCoordinates | null = null;

      if (
        collector.pfGeo &&
        typeof collector.pfGeo === 'object' &&
        'lat' in collector.pfGeo &&
        'lng' in collector.pfGeo &&
        typeof collector.pfGeo.lat === 'number' &&
        typeof collector.pfGeo.lng === 'number'
      ) {
        collectorCoords = {
          lat: collector.pfGeo.lat,
          lng: collector.pfGeo.lng,
        };
      } else if (
        collector.pjGeo &&
        typeof collector.pjGeo === 'object' &&
        'lat' in collector.pjGeo &&
        'lng' in collector.pjGeo &&
        typeof collector.pjGeo.lat === 'number' &&
        typeof collector.pjGeo.lng === 'number'
      ) {
        collectorCoords = {
          lat: collector.pjGeo.lat,
          lng: collector.pjGeo.lng,
        };
      }

      if (!collectorCoords) {
        // Coletor sem coordenadas válidas - pular
        console.warn(`[PICKUP_FEE] Coletor ${collector.id} sem coordenadas válidas`);
        continue;
      }

      const distance = calculateDistance(originCoords, collectorCoords);

      collectorsWithDistance.push({
        ...collector,
        distance,
        coords: collectorCoords,
      });
    }

    if (collectorsWithDistance.length === 0) {
      return {
        success: false,
        error: 'Nenhum coletor com coordenadas válidas disponível',
      };
    }

    // 4. Ordenar por distância e pegar o mais próximo
    collectorsWithDistance.sort((a, b) => a.distance - b.distance);
    const nearestCollector = collectorsWithDistance[0];

    // 5. Calcular taxa de coleta baseado no tipo
    let feeAmount = 0;

    if (nearestCollector.pickupFeeType === 'FIXED') {
      feeAmount = nearestCollector.pickupFixedFee ?? 0;
    } else if (nearestCollector.pickupFeeType === 'PER_KM') {
      const feePerKm = nearestCollector.pickupFeePerKm ?? 0;
      feeAmount = nearestCollector.distance * feePerKm;
    } else {
      return {
        success: false,
        error: `Tipo de taxa inválido: ${nearestCollector.pickupFeeType}`,
      };
    }

    // Arredondar para 2 casas decimais
    feeAmount = Math.round(feeAmount * 100) / 100;

    const totalWithPickup = freightCost + feeAmount;

    return {
      success: true,
      collector: {
        id: nearestCollector.id,
        nome: nearestCollector.pfNome,
        pfNome: nearestCollector.pfNome,
        pjRazaoSocial: nearestCollector.pjRazaoSocial,
      },
      distanceKm: nearestCollector.distance,
      feeType: nearestCollector.pickupFeeType as 'FIXED' | 'PER_KM',
      feeAmount,
      totalWithPickup,
    };
  } catch (error) {
    console.error('[PICKUP_FEE] Erro ao calcular taxa de coleta:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Formata valor em reais para exibição
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
