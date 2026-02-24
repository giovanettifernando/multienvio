import 'server-only';

/**
 * Loggi Tracking API
 *
 * Consulta rastreamento de pacotes na API da Loggi.
 * Endpoint: GET /v1/companies/{companyId}/packages/{trackingCode}/tracking
 */

import { loggiFetch, type LoggiFetchOptions } from './client';
import { LOGGI_ENDPOINTS } from './constants';
import type { LoggiTrackingResponse } from './types';

/**
 * Consulta o rastreamento de um pacote pelo tracking code
 */
export async function getLoggiTracking(
  trackingCode: string,
  options?: LoggiFetchOptions
): Promise<LoggiTrackingResponse> {
  const endpoint = LOGGI_ENDPOINTS.tracking
    .replace('{trackingCode}', encodeURIComponent(trackingCode));

  return loggiFetch<LoggiTrackingResponse>(endpoint, null, {
    method: 'GET',
    timeout: options?.timeout ?? 15_000,
    ...options,
  });
}
