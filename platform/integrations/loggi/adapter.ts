import 'server-only';

/**
 * Adapter para integração da Loggi com o sistema de cotação do Envio Legal
 *
 * Responsabilidades:
 * - Converter tipos internos para formato da API da Loggi
 * - Converter respostas da Loggi para tipos internos
 * - Integrar com o fluxo de cotação existente
 */

import type { QuoteResultItem } from '@/shared/types/quote';
import type { QuoteRequest } from '@/shared/validation/quote-backend';
import type { LoggiQuoteResponse, LoggiQuotation } from './types';
import { cotarLoggi, loggiMoneyToReais } from './cotacao';
import { getLoggiConfigAsync, validateLoggiConfig } from './client';
import { loggiVolumeValidator } from './loggi-volume-validator';
import { LOGGI_CARRIER_SLUG, LOGGI_CARRIER_NAME, LOGGI_FREIGHT_TYPES, LOGGI_PICKUP_TYPES } from './constants';
import type { VolumeInput, CarrierEligibility } from '../shared/volume-eligibility';

// ============================================================================
// Constantes
// ============================================================================

export const LOGGI_CARRIER_ID = LOGGI_CARRIER_SLUG;
export { LOGGI_CARRIER_NAME };

// ============================================================================
// Conversão de Tipos
// ============================================================================

/**
 * Mapeia freightType + pickupType para um ID de serviço interno único
 */
function quotationToServiceId(freightType: string, pickupType: string): string {
  const freight = freightType === LOGGI_FREIGHT_TYPES.EXPRESS
    ? 'express'
    : freightType === LOGGI_FREIGHT_TYPES.ECONOMIC
      ? 'economic'
      : freightType.replace('FREIGHT_TYPE_', '').toLowerCase();

  const pickup = pickupType === LOGGI_PICKUP_TYPES.DROP_OFF
    ? 'dropoff'
    : pickupType === LOGGI_PICKUP_TYPES.SPOT
      ? 'spot'
      : pickupType.replace('PICKUP_TYPE_', '').toLowerCase();

  return `${LOGGI_CARRIER_ID}-${freight}-${pickup}`;
}

/**
 * Gera label legível para a modalidade (freight + pickup)
 */
function quotationToLabel(quotation: LoggiQuotation): string {
  // Remove prefixo "Loggi " do label pois a coluna "Transportadora" já exibe "Loggi"
  const raw = quotation.freightTypeLabel || quotation.freightType;
  const base = raw.replace(/^Loggi\s+/i, '');
  if (quotation.pickupType === LOGGI_PICKUP_TYPES.DROP_OFF) {
    return `${base} (Postagem)`;
  }
  if (quotation.pickupType === LOGGI_PICKUP_TYPES.SPOT) {
    return `${base} (Coleta)`;
  }
  return base;
}

/**
 * Converte uma quotation da Loggi para QuoteResultItem
 */
function loggiQuotationToQuoteResult(quotation: LoggiQuotation): QuoteResultItem | null {
  const totalAmount = quotation.price?.totalAmount;
  if (!totalAmount) return null;

  const preco = loggiMoneyToReais(totalAmount);
  if (preco <= 0) return null;

  return {
    id: quotationToServiceId(quotation.freightType, quotation.pickupType),
    carrier: LOGGI_CARRIER_NAME,
    modalidade: quotationToLabel(quotation),
    prazoDias: quotation.sloInDays || 0,
    preco,
    exigeSeguro: false,
    source: 'real',
    externalServiceId: quotation.externalServiceId,
  };
}

/**
 * Converte resposta completa de cotação da Loggi para QuoteResultItem[]
 */
export function loggiQuotationToQuoteResults(
  response: LoggiQuoteResponse
): QuoteResultItem[] {
  const results: QuoteResultItem[] = [];

  if (!response.packagesQuotations || response.packagesQuotations.length === 0) {
    return results;
  }

  // Usar quotations do primeiro pacote (agregadas pela API)
  const firstPackage = response.packagesQuotations[0];
  if (!firstPackage?.quotations) return results;

  for (const quotation of firstPackage.quotations) {
    const result = loggiQuotationToQuoteResult(quotation);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

// ============================================================================
// Funções de Integração
// ============================================================================

/**
 * Verifica se a integração da Loggi está disponível
 */
export async function isLoggiAvailableAsync(): Promise<boolean> {
  const config = await getLoggiConfigAsync();
  const validation = validateLoggiConfig(config);
  return validation.valid;
}

/**
 * Resultado da cotação da Loggi com informações de elegibilidade
 */
export type LoggiQuoteResult = {
  results: QuoteResultItem[];
  source: 'real' | 'error';
  error?: string;
  eligibility?: CarrierEligibility;
};

/**
 * Obtém cotações da Loggi para uma requisição do Envio Legal
 */
export async function quoteFromLoggi(
  request: QuoteRequest
): Promise<LoggiQuoteResult> {
  const requestId = `loggi_${Date.now()}`;

  console.log('[LOGGI_ADAPTER] Starting quote:', {
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
    loggiVolumeValidator.validateVolume(v)
  );
  const isEligible = volumeValidations.every((r) => r.isValid);

  const eligibility: CarrierEligibility = {
    carrierId: loggiVolumeValidator.carrierId,
    carrierName: loggiVolumeValidator.carrierName,
    isEligible,
    volumeResults: volumeValidations,
    overallReasons: isEligible
      ? []
      : [...new Set(volumeValidations.flatMap((r) => r.reasons))],
  };

  // 2. Se não elegível, retornar vazio
  if (!isEligible) {
    console.log('[LOGGI_ADAPTER] Volumes not eligible:', {
      requestId,
      invalidVolumes: volumeValidations
        .filter((r) => !r.isValid)
        .map((r) => ({ index: r.volumeIndex, reasons: r.reasons })),
    });

    return { results: [], source: 'real', eligibility };
  }

  // 3. Verificar se integração está configurada
  const isConfigured = await isLoggiAvailableAsync();
  if (!isConfigured) {
    console.warn('[LOGGI_ADAPTER] Integration not configured');
    return { results: [], source: 'error', error: 'INTEGRATION_DISABLED', eligibility };
  }

  try {
    // 4. Converter volumes para formato Loggi (peso em gramas)
    const packages = request.volumes.map((vol) => ({
      weightG: Math.round(vol.pesoKg * 1000),
      lengthCm: Math.round(vol.comprimentoCm),
      widthCm: Math.round(vol.larguraCm),
      heightCm: Math.round(vol.alturaCm),
      goodsValueCents: request.seguro ? Math.round(request.seguro * 100) : undefined,
    }));

    // 5. Consultar API da Loggi
    const response = await cotarLoggi({
      originCep: request.origem.cep,
      destCep: request.destino.cep,
      packages,
    });

    // 6. Converter para formato interno
    const results = loggiQuotationToQuoteResults(response);

    console.log('[LOGGI_ADAPTER] Quote completed:', {
      requestId,
      total: results.length,
      options: results.map((r) => ({ id: r.id, preco: r.preco, prazo: r.prazoDias })),
    });

    return { results, source: 'real', eligibility };
  } catch (error) {
    console.error('[LOGGI_ADAPTER] Quote failed:', {
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
 * Verifica se um serviceId pertence à Loggi
 */
export function isLoggiService(serviceId: string): boolean {
  return serviceId.startsWith(LOGGI_CARRIER_ID + '-');
}

/**
 * Extrai o tipo de frete do serviceId
 */
export function extractLoggiFreightType(serviceId: string): string | null {
  if (!serviceId.startsWith(LOGGI_CARRIER_ID + '-')) {
    return null;
  }
  return serviceId.replace(LOGGI_CARRIER_ID + '-', '');
}
