/**
 * POST /api/webhooks/mercadopago
 *
 * Webhook para receber notificações do Mercado Pago
 *
 * Referência: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */


import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { processWebhook } from '@/lib/mercadopago';
import type { MercadoPagoWebhookPayload, WebhookHeaders } from '@/lib/mercadopago';
import { logger } from '@/lib/logger';

interface WebhookProcessResponse {
  success: boolean;
  message: string;
}

interface WebhookHealthResponse {
  service: string;
  status: string;
  timestamp: string;
}

/**
 * POST - Recebe notificações do Mercado Pago
 *
 * IMPORTANTE: Este endpoint é público (sem autenticação) pois será chamado pelo Mercado Pago.
 * A validação de autenticidade é feita via assinatura HMAC-SHA256.
 */
export const POST = withApiHandler<WebhookProcessResponse>(async (context) => {
  // Extrair headers necessários
  const headers: WebhookHeaders = {
    'x-signature': context.req.headers.get('x-signature') || undefined,
    'x-request-id': context.req.headers.get('x-request-id') || undefined,
  };

  // Log de recebimento (sem dados sensíveis)
  logger.info({
    event: 'webhook_mp_received',
    hasSignature: !!headers['x-signature'],
    hasRequestId: !!headers['x-request-id'],
  }, 'Webhook MercadoPago received');

  // Parse payload
  const payload: MercadoPagoWebhookPayload = await context.req.json();

  logger.info({
    event: 'webhook_mp_payload',
    id: payload.id,
    type: payload.type,
    action: payload.action,
    dataId: payload.data?.id,
  }, 'Processing MercadoPago webhook');

  // Processar webhook
  const success = await processWebhook(payload, headers);

  if (success) {
    // Retornar 200 OK para o Mercado Pago
    return {
      data: {
        success: true,
        message: 'Webhook processado com sucesso',
      },
      status: 200,
    };
  } else {
    // Retornar 400 para indicar que não devem reenviar
    throw ApiError.badRequest('Webhook não pôde ser processado');
  }
});

/**
 * GET - Health check (não usado pelo MP, apenas para testes)
 */
export const GET = withApiHandler<WebhookHealthResponse>(async () => {
  return {
    data: {
      service: 'Mercado Pago Webhook',
      status: 'online',
      timestamp: new Date().toISOString(),
    },
  };
});
