import 'server-only';

import type { QuoteResultItem } from '@/shared/types/quote';
import type { QuoteRequest } from '@/shared/validation/quote-backend';
import { cotarTE } from './cotacao';
import { getTEConfigAsync, validateTEConfig } from './client';
import { totalExpressVolumeValidator } from './total-express-volume-validator';
import { TE_CARRIER_SLUG, TE_CARRIER_NAME, TE_SERVICE_LABELS, type TEServiceType } from './constants';
import type { VolumeInput, CarrierEligibility } from '../shared/volume-eligibility';

export const TE_CARRIER_ID = TE_CARRIER_SLUG;
export { TE_CARRIER_NAME };

export type TEQuoteResult = {
  results: QuoteResultItem[];
  source: 'real' | 'error';
  error?: string;
  eligibility?: CarrierEligibility;
};

export async function isTotalExpressAvailableAsync(): Promise<boolean> {
  const config = await getTEConfigAsync();
  return validateTEConfig(config).valid;
}

/**
 * For multi-volume requests:
 * - pesoG = sum of all volumes (grams)
 * - dimensions = max across all volumes (Total Express takes a single set of dims)
 */
export async function quoteFromTotalExpress(
  request: QuoteRequest
): Promise<TEQuoteResult> {
  const requestId = `te_${Date.now()}`;

  console.log('[TE_ADAPTER] Starting quote:', {
    requestId,
    origem: request.origem.cep,
    destino: request.destino.cep,
    volumes: request.volumes.length,
  });

  // 1. Validate volume eligibility
  const volumeInputs: VolumeInput[] = request.volumes.map((vol, index) => ({
    index,
    comprimentoCm: vol.comprimentoCm,
    larguraCm: vol.larguraCm,
    alturaCm: vol.alturaCm,
    pesoKg: vol.pesoKg,
  }));

  const volumeValidations = volumeInputs.map((v) =>
    totalExpressVolumeValidator.validateVolume(v)
  );
  const isEligible = volumeValidations.every((r) => r.isValid);

  const eligibility: CarrierEligibility = {
    carrierId: totalExpressVolumeValidator.carrierId,
    carrierName: totalExpressVolumeValidator.carrierName,
    isEligible,
    volumeResults: volumeValidations,
    overallReasons: isEligible
      ? []
      : [...new Set(volumeValidations.flatMap((r) => r.reasons))],
  };

  if (!isEligible) {
    console.log('[TE_ADAPTER] Volumes not eligible:', {
      requestId,
      invalidVolumes: volumeValidations
        .filter((r) => !r.isValid)
        .map((r) => ({ index: r.volumeIndex, reasons: r.reasons })),
    });
    return { results: [], source: 'real', eligibility };
  }

  // 2. Check if integration is configured
  const isConfigured = await isTotalExpressAvailableAsync();
  if (!isConfigured) {
    console.warn('[TE_ADAPTER] Integration not configured');
    return { results: [], source: 'error', error: 'INTEGRATION_DISABLED', eligibility };
  }

  try {
    // 3. Aggregate volumes: sum weights, use max dimensions
    const pesoTotalG = Math.round(
      request.volumes.reduce((sum, v) => sum + v.pesoKg, 0) * 1000
    );
    const comprimentoCm = Math.max(...request.volumes.map((v) => v.comprimentoCm));
    const larguraCm = Math.max(...request.volumes.map((v) => v.larguraCm));
    const alturaCm = Math.max(...request.volumes.map((v) => v.alturaCm));

    // 4. Quote all service types in parallel
    const cotacoes = await cotarTE({
      cepOrigem: request.origem.cep,
      cepDestino: request.destino.cep,
      pesoG: pesoTotalG,
      comprimentoCm,
      larguraCm,
      alturaCm,
      valorDeclaradoCentavos: request.seguro ? Math.round(request.seguro * 100) : undefined,
    });

    // 5. Convert to internal format
    const results: QuoteResultItem[] = cotacoes.map((c) => ({
      id: `${TE_CARRIER_ID}-${c.tipoServico.toLowerCase()}`,
      carrier: TE_CARRIER_NAME,
      modalidade: TE_SERVICE_LABELS[c.tipoServico as TEServiceType] ?? `Total Express ${c.tipoServico}`,
      prazoDias: c.prazo,
      preco: c.valorCentavos / 100,
      exigeSeguro: false,
      source: 'real' as const,
    }));

    console.log('[TE_ADAPTER] Quote completed:', {
      requestId,
      total: results.length,
      options: results.map((r) => ({ id: r.id, preco: r.preco, prazo: r.prazoDias })),
    });

    return { results, source: 'real', eligibility };
  } catch (error) {
    console.error('[TE_ADAPTER] Quote failed:', {
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

export function isTEService(serviceId: string): boolean {
  return serviceId.startsWith(TE_CARRIER_ID + '-');
}
