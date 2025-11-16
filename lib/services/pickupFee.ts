/**
 * Serviço de cálculo de taxa de coleta na origem
 *
 * NOVA IMPLEMENTAÇÃO COM POSTGIS:
 * - Usa PostGIS para cálculo de distância preciso
 * - Cache de coordenadas em cep_locations (PostgreSQL)
 * - Busca otimizada de coletor mais próximo com KNN
 *
 * Regras:
 * - Sempre selecionar o coletor MAIS PRÓXIMO do remetente
 * - Taxa pode ser FIXED (valor fixo) ou PER_KM (valor por km)
 * - Distância calculada com PostGIS ST_Distance (precisão em metros)
 */

import { findNearestCollectorByCep } from '@/lib/services/postgis';

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
  precision?: string; // Precisão do geocoding
  precisionWarning?: string; // Aviso se precisão for baixa
} | {
  success: false;
  error: string;
};

/**
 * Calcula taxa de coleta para uma cotação usando PostGIS
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
    console.log(`[PICKUP_FEE] Calculating for origin CEP: ${originCep}, freight: R$ ${freightCost}`);

    // 1. Validar CEP de origem
    const cleanOriginCep = originCep.replace(/\D/g, '');

    if (cleanOriginCep.length !== 8) {
      return { success: false, error: 'CEP de origem inválido' };
    }

    // 2. Encontrar coletor mais próximo usando PostGIS KNN
    const nearestCollector = await findNearestCollectorByCep(cleanOriginCep);

    if (!nearestCollector) {
      return {
        success: false,
        error: 'Nenhum coletor ativo disponível',
      };
    }

    console.log(`[PICKUP_FEE] Nearest collector:`, {
      id: nearestCollector.id,
      name: nearestCollector.name,
      distance: nearestCollector.distanceKm,
      feeType: nearestCollector.pickupFeeType,
    });

    // 3. Calcular taxa de coleta baseado no tipo
    let feeAmount = 0;

    if (nearestCollector.pickupFeeType === 'FIXED') {
      feeAmount = nearestCollector.pickupFixedFee ?? 0;
      console.log(`[PICKUP_FEE] Fixed fee: R$ ${feeAmount}`);
    } else if (nearestCollector.pickupFeeType === 'PER_KM') {
      const feePerKm = nearestCollector.pickupFeePerKm ?? 0;
      feeAmount = nearestCollector.distanceKm * feePerKm;
      console.log(`[PICKUP_FEE] Per-km fee: ${nearestCollector.distanceKm} km × R$ ${feePerKm} = R$ ${feeAmount}`);
    } else {
      return {
        success: false,
        error: `Tipo de taxa inválido: ${nearestCollector.pickupFeeType}`,
      };
    }

    // Arredondar para 2 casas decimais
    feeAmount = Math.round(feeAmount * 100) / 100;

    const totalWithPickup = freightCost + feeAmount;

    // Verificar precisão e adicionar aviso se necessário
    const precision = nearestCollector.precision;
    let precisionWarning: string | undefined;

    if (precision === 'city_fallback') {
      precisionWarning = 'Precisão moderada: coordenadas baseadas no centro da cidade. Distância pode variar.';
      console.warn(`[PICKUP_FEE] ⚠️  Precisão moderada (city_fallback) para CEP ${originCep}`);
    } else if (precision === 'state_fallback') {
      precisionWarning = 'Precisão baixa: coordenadas baseadas na capital do estado. Distância calculada é aproximada.';
      console.warn(`[PICKUP_FEE] ⚠️  Precisão BAIXA (state_fallback) para CEP ${originCep}`);
    }

    const result = {
      success: true as const,
      collector: {
        id: nearestCollector.id,
        nome: nearestCollector.pfNome || nearestCollector.pjRazaoSocial,
        pfNome: nearestCollector.pfNome,
        pjRazaoSocial: nearestCollector.pjRazaoSocial,
      },
      distanceKm: nearestCollector.distanceKm,
      feeType: nearestCollector.pickupFeeType as 'FIXED' | 'PER_KM',
      feeAmount,
      totalWithPickup,
      precision,
      precisionWarning,
    };

    console.log(`[PICKUP_FEE] Final calculation:`, {
      collector: nearestCollector.name,
      distance: nearestCollector.distanceKm,
      feeType: nearestCollector.pickupFeeType,
      calculatedFee: feeAmount,
      total: totalWithPickup,
      precision,
      precisionWarning: precisionWarning ? 'YES' : 'NO',
    });

    return result;
  } catch (error) {
    console.error('[PICKUP_FEE] Error:', error);
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
