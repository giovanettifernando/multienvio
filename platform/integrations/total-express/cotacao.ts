import 'server-only';

import type { TECotacaoInput, TECotacaoResult } from './types';
import { TEApiError } from './types';
import { TE_SERVICE_TYPES, type TEServiceType } from './constants';
import { teSoapCalcFrete } from './client';

/**
 * Queries all 4 service types in parallel via SOAP.
 * Returns only those that returned a valid price > 0.
 * For multi-volume requests, caller should pass totals:
 *   pesoG = sum of all volumes (grams)
 *   comprimento/largura/altura = max across all volumes
 */
export async function cotarTE(input: TECotacaoInput): Promise<TECotacaoResult[]> {
  const cepOrigem = input.cepOrigem.replace(/\D/g, '');
  const cepDestino = input.cepDestino.replace(/\D/g, '');

  if (cepOrigem.length !== 8) throw new TEApiError('VALIDATION', `CEP origem inválido: ${input.cepOrigem}`);
  if (cepDestino.length !== 8) throw new TEApiError('VALIDATION', `CEP destino inválido: ${input.cepDestino}`);
  if (input.pesoG <= 0) throw new TEApiError('VALIDATION', 'Peso deve ser maior que zero');
  if (input.comprimentoCm <= 0 || input.larguraCm <= 0 || input.alturaCm <= 0) {
    throw new TEApiError('VALIDATION', 'Dimensões devem ser maiores que zero');
  }

  const serviceTypes: TEServiceType[] = [
    TE_SERVICE_TYPES.EXP,
    TE_SERVICE_TYPES.ESP,
    TE_SERVICE_TYPES.PRM,
    TE_SERVICE_TYPES.STD,
  ];

  const results = await Promise.allSettled(
    serviceTypes.map(async (tipoServico) => {
      const soapResult = await teSoapCalcFrete({
        TipoServico: tipoServico,
        CepDestino: cepDestino,
        Peso: (input.pesoG / 1000).toFixed(2),
        ValorDeclarado: input.valorDeclaradoCentavos != null
          ? (input.valorDeclaradoCentavos / 100).toFixed(2)
          : undefined,
        TipoEntrega: 0,
        ServicoCOD: false,
        Altura: Math.round(input.alturaCm),
        Largura: Math.round(input.larguraCm),
        Profundidade: Math.round(input.comprimentoCm),
      });

      if (soapResult.Prazo <= 0 || soapResult.ValorServico <= 0) {
        return null;
      }

      return {
        tipoServico,
        prazo: soapResult.Prazo,
        valorCentavos: Math.round(soapResult.ValorServico * 100),
      } satisfies TECotacaoResult;
    })
  );

  const cotacoes: TECotacaoResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      cotacoes.push(result.value);
    } else if (result.status === 'rejected') {
      console.warn('[TE_COTACAO] Service type failed:', result.reason);
    }
  }

  return cotacoes;
}
