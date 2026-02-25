import 'server-only';

/**
 * Geração de etiquetas na Loggi
 *
 * Endpoint: POST /v1/companies/{companyId}/labels
 *
 * Gera etiquetas em PDF (base64 ou URL) a partir dos loggiKeys
 * retornados pela criação de shipment.
 */

import type { LoggiLabelResponse } from './types';
import { LoggiApiError } from './types';
import {
  LOGGI_ENDPOINTS,
  LOGGI_LABEL_RESPONSE_TYPES,
  LOGGI_LABEL_FORMATS,
  LOGGI_LABEL_LAYOUTS,
} from './constants';
import { loggiFetch } from './client';

/**
 * Gera etiquetas da Loggi a partir dos loggiKeys
 *
 * @param loggiKeys - Array de loggiKeys retornados pelo createAsyncShipment
 * @param layout - Tamanho da etiqueta: A4 ou A6
 * @returns Response com success.content (PDF em base64) ou success.url
 */
export async function printLoggiLabel(
  loggiKeys: string[],
  layout: 'LABEL_LAYOUT_A4' | 'LABEL_LAYOUT_A6' = 'LABEL_LAYOUT_A4'
): Promise<LoggiLabelResponse> {
  if (!loggiKeys || loggiKeys.length === 0) {
    throw new LoggiApiError('VALIDATION', 'loggiKeys é obrigatório');
  }

  console.log('[LOGGI_LABEL] Printing label:', { loggiKeys, layout });

  // Labels bypass circuit breaker — 500 errors from async label generation
  // should NOT block shipment creation or other operations
  const response = await loggiFetch<LoggiLabelResponse>(
    LOGGI_ENDPOINTS.label,
    {
      loggiKeys,
      responseType: LOGGI_LABEL_RESPONSE_TYPES.BASE64,
      format: LOGGI_LABEL_FORMATS.PDF,
      layout: layout || LOGGI_LABEL_LAYOUTS.A4,
    },
    { skipCircuitBreaker: true },
  );

  console.log('[LOGGI_LABEL] Label response:', {
    hasContent: !!response.success?.content,
    hasUrl: !!response.success?.url,
    failures: response.failure?.length || 0,
  });

  return response;
}
