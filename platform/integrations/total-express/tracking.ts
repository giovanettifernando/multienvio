import 'server-only';

import type { TETrackingResponse } from './types';
import { TEApiError } from './types';
import { TE_ENDPOINTS } from './constants';
import { teFetch } from './client';

export async function getTETracking(awb: string): Promise<TETrackingResponse> {
  if (!awb) throw new TEApiError('VALIDATION', 'AWB é obrigatório para rastreamento');

  console.log('[TE_TRACKING] Querying tracking for AWB:', awb);

  const response = await teFetch<TETrackingResponse>(TE_ENDPOINTS.tracking, {
    method: 'GET',
    query: { awb },
  });

  console.log('[TE_TRACKING] Response:', {
    status: response.status,
    encomendas: response.encomendas?.length || 0,
  });

  return response;
}
