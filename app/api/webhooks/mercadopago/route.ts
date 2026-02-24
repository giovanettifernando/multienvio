/**
 * POST /api/webhooks/mercadopago
 *
 * Webhook para receber notificações do Mercado Pago.
 *
 * Fluxo (com BullMQ):
 * 1. Parse JSON + validar schema Zod
 * 2. Validar assinatura HMAC-SHA256
 * 3. Deduplicar por externalId (se já processado, retorna 200)
 * 4. Registrar webhook no banco com status PENDING
 * 5. Enfileirar job no BullMQ para processamento assíncrono
 * 6. Retornar 200 ao MP
 *
 * O processamento pesado (consulta MP API + atualização de pagamento + wallet)
 * acontece no worker, com retry automático e DLQ.
 *
 * Referência: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { validateWebhookSignature } from '@/platform/integrations/mercadopago';
import type { MercadoPagoWebhookPayload, WebhookHeaders } from '@/platform/integrations/mercadopago';
import { logger } from '@/platform/logging/logger';
import { prisma } from '@/platform/db/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import type { MercadoPagoWebhookJobPayload } from '@/platform/queue/types';

/**
 * Schema de validação para webhook do MercadoPago
 */
const MercadoPagoWebhookSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  live_mode: z.boolean().optional(),
  type: z.string().max(100).optional(),
  date_created: z.string().optional(),
  user_id: z.union([z.string(), z.number()]).optional(),
  api_version: z.string().max(20).optional(),
  action: z.string().max(100).optional(),
  data: z.object({
    id: z.union([z.string(), z.number()]).optional(),
  }).passthrough().optional(),
}).passthrough();

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
 * IMPORTANTE: Endpoint público. Autenticidade via HMAC-SHA256.
 * Responde 200 somente após validação mínima (HMAC + schema + dedup).
 * Processamento pesado é delegado ao worker BullMQ.
 */
export const POST = withApiHandler<WebhookProcessResponse>(async (context) => {
  // 1. Extrair headers
  const headers: WebhookHeaders = {
    'x-signature': context.req.headers.get('x-signature') || undefined,
    'x-request-id': context.req.headers.get('x-request-id') || undefined,
  };

  logger.info({
    event: 'webhook_mp_received',
    hasSignature: !!headers['x-signature'],
    hasRequestId: !!headers['x-request-id'],
  }, 'Webhook MercadoPago received');

  // 2. Parse e validar schema
  let rawPayload: unknown;
  try {
    rawPayload = await context.req.json();
  } catch {
    throw ApiError.badRequest('JSON inválido');
  }

  const parseResult = MercadoPagoWebhookSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    logger.warn({
      event: 'webhook_mp_invalid_payload',
      errors: parseResult.error.issues,
    }, 'Invalid MercadoPago webhook payload');
    throw ApiError.badRequest('Payload inválido');
  }

  const payload = parseResult.data as MercadoPagoWebhookPayload;

  // 3. Validar assinatura HMAC-SHA256 (ANTES de enfileirar)
  const isValid = await validateWebhookSignature(payload, headers);

  if (!isValid) {
    logger.warn({
      event: 'webhook_mp_invalid_signature',
      type: payload.type,
      action: payload.action,
      dataId: payload.data?.id,
    }, 'Webhook rejected — invalid HMAC signature');
    throw ApiError.badRequest('Assinatura inválida');
  }

  // 4. Buscar gateway
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago', status: 'ACTIVE' },
  });

  if (!gateway) {
    logger.error({ event: 'webhook_mp_no_gateway' }, 'Gateway Mercado Pago not found');
    throw ApiError.badRequest('Gateway não configurado');
  }

  // 5. Deduplicação: se já processou esse externalId, retorna 200
  const externalId = payload.data?.id;
  if (externalId) {
    const existing = await prisma.paymentWebhook.findFirst({
      where: {
        gatewayId: gateway.id,
        externalId,
        status: 'PROCESSED',
      },
    });

    if (existing) {
      logger.info({
        event: 'webhook_mp_deduplicated',
        externalId,
      }, 'Webhook already processed — returning 200');
      return {
        data: { success: true, message: 'Já processado' },
        status: 200,
      };
    }
  }

  // 6. Registrar webhook no banco como PENDING
  const webhookRecord = await prisma.paymentWebhook.create({
    data: {
      gatewayId: gateway.id,
      eventType: payload.action || payload.type,
      externalId: payload.data?.id,
      payload: payload as unknown as Prisma.InputJsonValue,
      signature: headers['x-signature'],
      status: 'PENDING',
    },
  });

  // 7. Enfileirar job para processamento assíncrono
  const queue = getQueue<MercadoPagoWebhookJobPayload>(QUEUE_NAMES.WEBHOOK_MERCADOPAGO);

  await queue.add(
    'process',
    {
      webhookRecordId: webhookRecord.id,
      payload: payload as MercadoPagoWebhookJobPayload['payload'],
    },
    {
      priority: JOB_PRIORITY.CRITICAL,
      jobId: `mp-webhook-${webhookRecord.id}`,
    }
  );

  logger.info({
    event: 'webhook_mp_enqueued',
    webhookRecordId: webhookRecord.id,
    paymentId: payload.data?.id,
    action: payload.action,
  }, 'Webhook validated and enqueued for processing');

  // 8. Retornar 200 ao MP (validação OK, processamento será assíncrono)
  return {
    data: {
      success: true,
      message: 'Webhook recebido e enfileirado para processamento',
    },
    status: 200,
  };
});

/**
 * GET - Health check
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
