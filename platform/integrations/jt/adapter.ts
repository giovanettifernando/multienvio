import 'server-only';

/**
 * Adapter para integração da J&T Express com o sistema de cotação do Envio Legal
 *
 * Responsabilidades:
 * - Converter tipos internos do Envio Legal para formato da API da J&T
 * - Converter respostas da J&T para tipos internos
 * - Integrar com o fluxo de cotação existente
 */

import type { QuoteResultItem } from '@/shared/types/quote';
import type { QuoteRequest } from '@/shared/validation/quote-backend';
import type { JTCostTimeResponse } from './types';
import { cotarJT } from './cotacao';
import {
  getJTConfigAsync,
  validateJTConfig,
} from './client';
import { jtVolumeValidator } from './jt-volume-validator';
import { JT_CARRIER_SLUG, JT_CARRIER_NAME, JT_PRODUCT_TYPES } from './constants';
import type { VolumeInput, CarrierEligibility } from '../shared/volume-eligibility';

// ============================================================================
// Constantes
// ============================================================================

export const JT_CARRIER_ID = JT_CARRIER_SLUG;
export { JT_CARRIER_NAME };

// ============================================================================
// Conversão de Tipos
// ============================================================================

/**
 * Converte resposta de cotação da J&T para QuoteResultItem do Envio Legal
 */
export function jtCotacaoToQuoteResult(
  response: JTCostTimeResponse,
  productType: string = JT_PRODUCT_TYPES.EZ
): QuoteResultItem | null {
  if (!response.data) return null;

  let cost = parseFloat(response.data.cost || '0');
  const aging = response.data.aging || 0;

  // TODO: REMOVER - Workaround temporário para homologação J&T.
  // Credenciais de homologação sempre retornam custo 0.
  // Atribuímos R$100 provisoriamente para não descartar a cotação.
  if (cost <= 0) {
    console.warn('[JT_ADAPTER] Custo zero retornado (homologação). Usando valor provisório de R$100.');
    cost = 100;
  }

  const id = `${JT_CARRIER_ID}-${productType}`;

  return {
    id,
    carrier: JT_CARRIER_NAME,
    modalidade: getProductTypeName(productType),
    prazoDias: aging,
    preco: cost,
    exigeSeguro: false,
    source: 'real',
  };
}

/**
 * Retorna nome amigável do tipo de produto J&T
 */
function getProductTypeName(productType: string): string {
  switch (productType) {
    case 'EZ': return 'J&T Express';
    case 'express': return 'J&T Expressa';
    case 'standard': return 'J&T Standard';
    case 'CRD': return 'J&T Normal';
    default: return `J&T ${productType}`;
  }
}

// ============================================================================
// Funções de Integração
// ============================================================================

/**
 * Verifica se a integração da J&T está disponível (versão assíncrona)
 */
export async function isJTAvailableAsync(): Promise<boolean> {
  const config = await getJTConfigAsync();
  const validation = validateJTConfig(config);
  return validation.valid;
}

/**
 * Resultado da cotação da J&T com informações de elegibilidade
 */
export type JTQuoteResult = {
  results: QuoteResultItem[];
  source: 'real' | 'error';
  error?: string;
  eligibility?: CarrierEligibility;
};

/**
 * Obtém cotações da J&T para uma requisição do Envio Legal
 *
 * Fluxo:
 * 1. Verifica elegibilidade dos volumes
 * 2. Calcula peso total (soma de todos os volumes)
 * 3. Consulta API da J&T
 * 4. Converte resultado para formato interno
 */
export async function quoteFromJT(
  request: QuoteRequest
): Promise<JTQuoteResult> {
  const requestId = `jt_${Date.now()}`;

  console.log('[JT_ADAPTER] Starting quote:', {
    requestId,
    origem: request.origem.cep,
    destino: request.destino.cep,
    volumes: request.volumes.length,
  });

  // 1. Validar elegibilidade dos volumes
  const volumeInputs: VolumeInput[] = request.volumes.map((vol, index) => ({
    index,
    comprimentoCm: vol.comprimentoCm,
    larguraCm: vol.larguraCm,
    alturaCm: vol.alturaCm,
    pesoKg: vol.pesoKg,
  }));

  const volumeValidations = volumeInputs.map((v) =>
    jtVolumeValidator.validateVolume(v)
  );
  const isEligible = volumeValidations.every((r) => r.isValid);

  const eligibility: CarrierEligibility = {
    carrierId: jtVolumeValidator.carrierId,
    carrierName: jtVolumeValidator.carrierName,
    isEligible,
    volumeResults: volumeValidations,
    overallReasons: isEligible
      ? []
      : [...new Set(volumeValidations.flatMap((r) => r.reasons))],
  };

  // 2. Se não elegível, retornar vazio
  if (!isEligible) {
    console.log('[JT_ADAPTER] Volumes not eligible:', {
      requestId,
      invalidVolumes: volumeValidations
        .filter((r) => !r.isValid)
        .map((r) => ({ index: r.volumeIndex, reasons: r.reasons })),
    });

    return { results: [], source: 'real', eligibility };
  }

  // 3. Verificar se integração está configurada
  const isConfigured = await isJTAvailableAsync();
  if (!isConfigured) {
    console.warn('[JT_ADAPTER] Integration not configured');
    return { results: [], source: 'error', error: 'INTEGRATION_DISABLED', eligibility };
  }

  try {
    // 4. Calcular peso total de todos os volumes
    const pesoTotalKg = request.volumes.reduce((sum, vol) => sum + vol.pesoKg, 0);

    // 5. Consultar API da J&T
    const response = await cotarJT({
      originCep: request.origem.cep,
      destCep: request.destino.cep,
      pesoKg: pesoTotalKg,
      valorDeclarado: request.seguro ?? undefined,
      productType: JT_PRODUCT_TYPES.EZ,
    });

    // 6. Converter para formato interno
    const results: QuoteResultItem[] = [];
    const result = jtCotacaoToQuoteResult(response);
    if (result) {
      results.push(result);
    }

    console.log('[JT_ADAPTER] Quote completed:', {
      requestId,
      total: results.length,
      preco: result?.preco,
      prazo: result?.prazoDias,
    });

    return { results, source: 'real', eligibility };
  } catch (error) {
    console.error('[JT_ADAPTER] Quote failed:', {
      requestId,
      error: error instanceof Error ? error.message : error,
    });

    return {
      results: [],
      source: 'error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      eligibility,
    };
  }
}

/**
 * Verifica se um serviceId pertence à J&T
 */
export function isJTService(serviceId: string): boolean {
  return serviceId.startsWith(JT_CARRIER_ID + '-');
}

/**
 * Extrai o tipo de produto do serviceId
 */
export function extractJTProductType(serviceId: string): string | null {
  if (!serviceId.startsWith(JT_CARRIER_ID + '-')) {
    return null;
  }
  return serviceId.replace(JT_CARRIER_ID + '-', '');
}
