import 'server-only';

/**
 * Cotação de preço e prazo via API da J&T Express
 *
 * Endpoint: POST /webopenplatformapi/api/spmComCost/getComCostAndTime
 *
 * Permite consultar o custo de frete e prazo de entrega
 * antes de criar um pedido.
 */

import { type JTCostTimeResponse, JTApiError } from './types';
import { JT_ENDPOINTS, JT_PRODUCT_TYPES } from './constants';
import { jtFetch } from './client';

// ============================================================================
// Input de Cotação
// ============================================================================

export interface JTCotacaoInput {
  /** CEP de origem */
  originCep?: string;
  /** CEP de destino (obrigatório) */
  destCep: string;
  /** Peso em kg (0.01 a 30) */
  pesoKg: number;
  /** Tipo de produto (default: EZ) */
  productType?: string;
  /** Valor declarado para seguro (opcional) */
  valorDeclarado?: number;
  /** Código do tipo de mercadoria (opcional) */
  goodsTypeCode?: string;
}

// ============================================================================
// Cotação
// ============================================================================

/**
 * Consulta preço e prazo na API da J&T
 */
export async function cotarJT(input: JTCotacaoInput): Promise<JTCostTimeResponse> {
  // Validar peso
  if (input.pesoKg <= 0 || input.pesoKg > 30) {
    throw new JTApiError('VALIDATION', `Peso inválido: ${input.pesoKg}kg. Deve ser entre 0.01 e 30kg.`);
  }

  // Validar CEP destino
  const destCep = input.destCep.replace(/\D/g, '');
  if (destCep.length !== 8) {
    throw new JTApiError('VALIDATION', `CEP destino inválido: ${input.destCep}`);
  }

  // Montar payload de negócio (customerCode e digest são adicionados pelo jtFetch)
  const bizContent: Record<string, unknown> = {
    destinationZipCode: destCep,
    productTypeCode: input.productType || JT_PRODUCT_TYPES.EZ,
    weight: input.pesoKg.toFixed(2),
  };

  // CEP origem (opcional mas recomendado)
  if (input.originCep) {
    const originCep = input.originCep.replace(/\D/g, '');
    if (originCep.length === 8) {
      bizContent.originZipCode = originCep;
    }
  }

  // Valor declarado / seguro
  if (input.valorDeclarado && input.valorDeclarado > 0) {
    bizContent.insuredAmount = input.valorDeclarado.toFixed(2);
  }

  // Tipo de mercadoria
  if (input.goodsTypeCode) {
    bizContent.goodsTypeCode = input.goodsTypeCode;
  }

  console.log('[JT_COTACAO] Requesting quote:', {
    destCep,
    originCep: input.originCep || '(não informado)',
    pesoKg: input.pesoKg,
    productType: bizContent.productTypeCode,
  });

  const response = await jtFetch<JTCostTimeResponse>(
    JT_ENDPOINTS.getComCostAndTime,
    bizContent,
    { useCostApiBase: true }
  );

  console.log('[JT_COTACAO] Quote response:', {
    cost: response.data?.cost,
    aging: response.data?.aging,
    riskPremiumFee: response.data?.riskPremiumFee,
  });

  return response;
}

