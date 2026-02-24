import 'server-only';

/**
 * Geração de etiquetas na J&T Express (printOrder)
 *
 * Endpoint: POST /webopenplatformapi/api/order/printOrder
 *
 * Gera etiqueta de envio em PDF (base64) a partir do billCode
 * retornado pela criação de pedido.
 *
 * Tamanhos disponíveis:
 * - 0: Uma via (padrão)
 * - 1: Duas vias
 * - 2: A4
 */

import type { JTPrintOrderResponse } from './types';
import { JTApiError } from './types';
import { JT_ENDPOINTS } from './constants';
import { jtFetch } from './client';

/**
 * Gera etiqueta da J&T a partir do billCode
 *
 * @param billCode - Código do pedido retornado pelo addOrder
 * @param printSize - Tamanho da etiqueta: 0=uma via, 1=duas vias, 2=A4
 * @returns Response com data.base64EncodeContent (PDF em base64)
 */
export async function printJTLabel(
  billCode: string,
  printSize: number = 0
): Promise<JTPrintOrderResponse> {
  if (!billCode) {
    throw new JTApiError('VALIDATION', 'billCode é obrigatório');
  }

  console.log('[JT_LABEL] Printing label:', { billCode, printSize });

  const response = await jtFetch<JTPrintOrderResponse>(
    JT_ENDPOINTS.printOrder,
    { billCode, printSize },
  );

  console.log('[JT_LABEL] Label response:', {
    code: response.code,
    msg: response.msg,
    billCode: response.data?.billCode,
    hasContent: !!response.data?.base64EncodeContent,
    contentLength: response.data?.base64EncodeContent?.length ?? 0,
  });

  return response;
}
