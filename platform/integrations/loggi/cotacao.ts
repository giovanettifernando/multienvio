import 'server-only';

/**
 * Cotação de preço e prazo via API da Loggi
 *
 * Endpoint: POST /v1/companies/{companyId}/quotations
 *
 * Permite consultar custo de frete e prazo de entrega.
 * Retorna múltiplas opções (Express e Econômico).
 */

import type {
  LoggiQuoteResponse,
  LoggiMoney,
  LoggiQuotePackage,
  LoggiAddress,
} from './types';
import { LoggiApiError } from './types';
import { LOGGI_ENDPOINTS, LOGGI_LIMITS } from './constants';
import { loggiFetch } from './client';
import { consultarCep } from '@/platform/integrations/correios';

// ============================================================================
// Input
// ============================================================================

export interface LoggiCotacaoInput {
  /** CEP de origem */
  originCep: string;
  /** CEP de destino */
  destCep: string;
  /** Pacotes para cotação */
  packages: Array<{
    /** Peso em gramas */
    weightG: number;
    /** Comprimento em cm */
    lengthCm: number;
    /** Largura em cm */
    widthCm: number;
    /** Altura em cm */
    heightCm: number;
    /** Valor declarado em centavos (opcional) */
    goodsValueCents?: number;
  }>;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Converte LoggiMoney para valor em reais
 */
export function loggiMoneyToReais(money: LoggiMoney): number {
  const units = Number(money.units) || 0;
  const nanos = Number(money.nanos) || 0;
  return units + nanos / 1_000_000_000;
}

/**
 * Converte centavos para LoggiMoney
 */
export function centavosToLoggiMoney(centavos: number): LoggiMoney {
  const reais = centavos / 100;
  const units = Math.floor(reais);
  const nanos = Math.round((reais - units) * 1_000_000_000);
  return { currencyCode: 'BRL', units, nanos };
}

/**
 * Resolve CEP via Correios/BrasilAPI e monta endereço real para a Loggi.
 * Se a resolução falhar, lança erro para não cotar rotas com dados inválidos.
 */
async function cepToAddress(cep: string): Promise<LoggiAddress> {
  const cleanCep = cep.replace(/\D/g, '');
  const result = await consultarCep(cleanCep);
  return {
    correios: {
      logradouro: result.logradouro || 'Rua',
      numero: 'S/N',
      bairro: result.bairro || 'Centro',
      cep: cleanCep,
      cidade: result.cidade,
      uf: result.uf,
    },
  };
}

// ============================================================================
// Cotação
// ============================================================================

/**
 * Consulta preço e prazo na API da Loggi
 */
export async function cotarLoggi(input: LoggiCotacaoInput): Promise<LoggiQuoteResponse> {
  // Validar CEPs
  const originCep = input.originCep.replace(/\D/g, '');
  const destCep = input.destCep.replace(/\D/g, '');

  if (originCep.length !== 8) {
    throw new LoggiApiError('VALIDATION', `CEP origem inválido: ${input.originCep}`);
  }
  if (destCep.length !== 8) {
    throw new LoggiApiError('VALIDATION', `CEP destino inválido: ${input.destCep}`);
  }

  // Validar pacotes
  if (!input.packages || input.packages.length === 0) {
    throw new LoggiApiError('VALIDATION', 'Pelo menos um pacote é obrigatório');
  }

  for (const pkg of input.packages) {
    if (pkg.weightG <= 0 || pkg.weightG > LOGGI_LIMITS.MAX_WEIGHT_G) {
      throw new LoggiApiError('VALIDATION', `Peso inválido: ${pkg.weightG}g. Deve ser entre 1 e ${LOGGI_LIMITS.MAX_WEIGHT_G}g.`);
    }
  }

  // Resolver endereços reais via Correios/BrasilAPI em paralelo
  const [shipFrom, shipTo] = await Promise.all([
    cepToAddress(originCep),
    cepToAddress(destCep),
  ]);

  const packages: LoggiQuotePackage[] = input.packages.map((pkg) => {
    const result: LoggiQuotePackage = {
      weightG: Math.round(pkg.weightG),
      lengthCm: Math.round(pkg.lengthCm),
      widthCm: Math.round(pkg.widthCm),
      heightCm: Math.round(pkg.heightCm),
    };

    if (pkg.goodsValueCents && pkg.goodsValueCents > 0) {
      result.goodsValue = centavosToLoggiMoney(pkg.goodsValueCents);
    }

    return result;
  });

  console.log('[LOGGI_COTACAO] Requesting quote:', {
    originCep,
    destCep,
    packages: packages.length,
    totalWeightG: packages.reduce((s, p) => s + p.weightG, 0),
  });

  const response = await loggiFetch<LoggiQuoteResponse>(
    LOGGI_ENDPOINTS.quote,
    {
      shipFrom,
      shipTo,
      packages,
      pickupTypes: ['PICKUP_TYPE_SPOT', 'PICKUP_TYPE_DROP_OFF'],
    },
  );

  const totalQuotations = response.packagesQuotations?.reduce(
    (sum, pq) => sum + (pq.quotations?.length || 0), 0
  ) || 0;

  console.log('[LOGGI_COTACAO] Quote response:', {
    packagesQuotations: response.packagesQuotations?.length || 0,
    totalQuotations,
  });

  return response;
}
