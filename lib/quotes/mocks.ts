import type { QuoteResultItem } from '@/types/quote';
import type { QuoteRequest } from '@/lib/validation/quote-backend';

/**
 * Mocks de cotações por transportadora
 * Usados como fallback quando integrações não estão disponíveis
 */

export type CarrierCode = 'CORREIOS' | 'JADLOG' | 'LOGGI' | 'JT';

export interface MockQuoteConfig {
  carrier: string;
  serviceCode: string;
  serviceName: string;
  basePrice: number;
  baseDays: number;
  pickupAvailable: boolean;
  requiresInsurance: boolean;
}

const MOCK_QUOTES: Record<CarrierCode, MockQuoteConfig[]> = {
  CORREIOS: [
    {
      carrier: 'Correios',
      serviceCode: 'PAC',
      serviceName: 'PAC',
      basePrice: 25.5,
      baseDays: 10,
      pickupAvailable: false,
      requiresInsurance: false,
    },
    {
      carrier: 'Correios',
      serviceCode: 'SEDEX',
      serviceName: 'SEDEX',
      basePrice: 45.0,
      baseDays: 5,
      pickupAvailable: false,
      requiresInsurance: false,
    },
    {
      carrier: 'Correios',
      serviceCode: 'SEDEX10',
      serviceName: 'SEDEX 10',
      basePrice: 55.0,
      baseDays: 2,
      pickupAvailable: false,
      requiresInsurance: false,
    },
  ],
  JADLOG: [
    {
      carrier: 'Jadlog',
      serviceCode: 'PACKAGE',
      serviceName: '.Package',
      basePrice: 30.0,
      baseDays: 7,
      pickupAvailable: true,
      requiresInsurance: true,
    },
    {
      carrier: 'Jadlog',
      serviceCode: 'COM',
      serviceName: '.COM',
      basePrice: 50.0,
      baseDays: 4,
      pickupAvailable: true,
      requiresInsurance: true,
    },
    {
      carrier: 'Jadlog',
      serviceCode: 'EXPRESS',
      serviceName: 'Jadlog Express',
      basePrice: 65.0,
      baseDays: 2,
      pickupAvailable: true,
      requiresInsurance: true,
    },
  ],
  LOGGI: [
    {
      carrier: 'Loggi',
      serviceCode: 'STANDARD',
      serviceName: 'Loggi Standard',
      basePrice: 28.0,
      baseDays: 5,
      pickupAvailable: true,
      requiresInsurance: false,
    },
    {
      carrier: 'Loggi',
      serviceCode: 'EXPRESS',
      serviceName: 'Loggi Express',
      basePrice: 42.0,
      baseDays: 3,
      pickupAvailable: true,
      requiresInsurance: false,
    },
  ],
  JT: [
    {
      carrier: 'J&T Express',
      serviceCode: 'STANDARD',
      serviceName: 'J&T Standard',
      basePrice: 22.0,
      baseDays: 8,
      pickupAvailable: true,
      requiresInsurance: false,
    },
    {
      carrier: 'J&T Express',
      serviceCode: 'ECONOMY',
      serviceName: 'J&T Economy',
      basePrice: 18.0,
      baseDays: 12,
      pickupAvailable: false,
      requiresInsurance: false,
    },
  ],
};

/**
 * Calcula o multiplicador de preço baseado no peso total
 */
function calculateWeightMultiplier(totalWeightKg: number): number {
  // Escala linear: 0kg = 1x, 30kg = 2x
  return 1 + Math.min(totalWeightKg, 30) / 30;
}

/**
 * Calcula o multiplicador de preço baseado no volume total
 */
function calculateVolumeMultiplier(totalVolumeCm3: number): number {
  // Escala linear: 0cm³ = 1x, 100000cm³ = 1.5x
  return 1 + Math.min(totalVolumeCm3, 100000) / 200000;
}

/**
 * Gera cotações mockadas para uma transportadora específica
 */
export function generateMockQuotes(
  carrier: CarrierCode,
  request: QuoteRequest
): QuoteResultItem[] {
  const configs = MOCK_QUOTES[carrier];
  if (!configs) {
    console.warn(`[MOCK] No mock config found for carrier: ${carrier}`);
    return [];
  }

  // Calculate total weight and volume
  const totalWeight = request.volumes.reduce((sum, vol) => sum + vol.pesoKg, 0);
  const totalVolume = request.volumes.reduce(
    (sum, vol) => sum + vol.comprimentoCm * vol.larguraCm * vol.alturaCm,
    0
  );

  const weightMultiplier = calculateWeightMultiplier(totalWeight);
  const volumeMultiplier = calculateVolumeMultiplier(totalVolume);
  const finalMultiplier = Math.max(weightMultiplier, volumeMultiplier);

  return configs.map((config) => ({
    id: `${carrier.toLowerCase()}-${config.serviceCode.toLowerCase()}`,
    carrier: config.carrier,
    modalidade: config.serviceName,
    prazoDias: config.baseDays,
    preco: Math.round(config.basePrice * finalMultiplier * 100) / 100,
    exigeSeguro: config.requiresInsurance,
    source: 'mock' as const,
  }));
}

/**
 * Gera todas as cotações mockadas para todas as transportadoras
 */
export function generateAllMockQuotes(request: QuoteRequest): QuoteResultItem[] {
  const carriers: CarrierCode[] = ['CORREIOS', 'JADLOG', 'LOGGI', 'JT'];

  return carriers.flatMap((carrier) => generateMockQuotes(carrier, request));
}

/**
 * Verifica se o erro indica necessidade de fallback para mock
 */
export function shouldUseMockFallback(error: unknown): boolean {
  if (!error) return false;

  const err = error as { message?: string; status?: number; code?: string };

  // Erros de autenticação/autorização
  if (err.status === 401 || err.status === 403 || err.status === 404) {
    return true;
  }

  // Erros de integração não configurada (check code)
  if (
    err.code === 'MISSING_INTEGRATION' ||
    err.code === 'INTEGRATION_DISABLED' ||
    err.code === 'INTEGRATION_INACTIVE'
  ) {
    return true;
  }

  // Erros de integração não configurada (check message)
  if (
    err.message?.includes('MISSING_INTEGRATION') ||
    err.message?.includes('INTEGRATION_DISABLED') ||
    err.message?.includes('INTEGRATION_INACTIVE')
  ) {
    return true;
  }

  // Timeouts
  if (
    err.message?.toLowerCase().includes('timeout') ||
    err.message?.toLowerCase().includes('econnrefused') ||
    err.message?.toLowerCase().includes('enotfound')
  ) {
    return true;
  }

  // Credenciais inválidas
  if (
    err.message?.toLowerCase().includes('credencial') ||
    err.message?.toLowerCase().includes('credential') ||
    err.message?.toLowerCase().includes('unauthorized')
  ) {
    return true;
  }

  return false;
}
