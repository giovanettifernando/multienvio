/**
 * POST /api/webhooks/pagarme
 *
 * Webhook para receber notificações do Pagar.me.
 *
 * Fluxo (com BullMQ):
 * 1. Parse JSON + validar schema Zod
 * 2. Extrair orderId do payload (Pagar.me não usa HMAC — verificação acontece no worker)
 * 3. Deduplicar por externalId (se já processado, retorna 200)
 * 4. Registrar webhook no banco com status PENDING
 * 5. Enfileirar job no BullMQ para processamento assíncrono (apenas se orderId presente)
 * 6. Retornar 200 ao Pagar.me
 *
 * Nota: Pagar.me não oferece assinatura HMAC. A autenticidade é verificada
 * no worker via chamada à API (verifyWebhookEvent → getOrder).
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/platform/logging/logger';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import { extractOrderIdFromPayload } from '@/platform/integrations/pagarme';
import type { PagarmeWebhookJobPayload } from '@/platform/queue/types';

const PayloadSchema = z.object({
  id: z.string().optional(),
  type: z.string().max(100),
  created_at: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

interface WebhookProcessResponse {
  success: boolean;
  message: string;
}

interface WebhookHealthResponse {
  service: string;
  status: string;
}

/**
 * POST - Recebe notificações do Pagar.me
 *
 * IMPORTANTE: Endpoint público. Pagar.me não provê HMAC — a verificação
 * de autenticidade é feita no worker via chamada à API.
 */
export const POST = withApiHandler<WebhookProcessResponse>(async (context) => {
  // 1. Parse JSON
  let raw: unknown;
  try {
    raw = await context.req.json();
  } catch {
    throw new ApiError({ code: 'INVALID_PAYLOAD', message: 'JSON inválido', status: 400 });
  }

  // 2. Validar schema
  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ event: 'webhook_pagarme_invalid_payload', errors: parsed.error.issues }, 'Invalid Pagar.me webhook payload');
    throw new ApiError({ code: 'INVALID_PAYLOAD', message: 'Payload inválido', status: 400 });
  }

  const payload = parsed.data;

  // 3. Buscar gateway ativo
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'pagarme', status: 'ACTIVE' },
  });

  if (!gateway) {
    logger.error({ event: 'webhook_pagarme_no_gateway' }, 'Gateway Pagar.me not found or inactive');
    throw new ApiError({ code: 'SERVICE_UNAVAILABLE', message: 'Gateway não configurado', status: 503 });
  }

  // 4. Extrair orderId e definir chave de deduplicação
  const pagarmePayload = payload as unknown as Parameters<typeof extractOrderIdFromPayload>[0];
  const orderId = extractOrderIdFromPayload(pagarmePayload);
  const dedupKey = orderId ?? payload.id ?? `unknown_${Date.now()}`;

  // 5. Deduplicação: se já processou esse externalId, retorna 200
  const existing = await prisma.paymentWebhook.findFirst({
    where: {
      gatewayId: gateway.id,
      externalId: dedupKey,
      status: 'PROCESSED',
    },
  });

  if (existing) {
    logger.info({ event: 'webhook_pagarme_deduplicated', externalId: dedupKey }, 'Webhook already processed — returning 200');
    return { data: { success: true, message: 'Já processado' } };
  }

  // 6. Registrar webhook no banco como PENDING
  const record = await prisma.paymentWebhook.create({
    data: {
      gatewayId: gateway.id,
      eventType: payload.type,
      externalId: dedupKey,
      payload: payload as unknown as Prisma.InputJsonValue,
      status: 'PENDING',
    },
  });

  // 7. Enfileirar job para processamento assíncrono (apenas se temos orderId)
  if (orderId) {
    const queue = getQueue<PagarmeWebhookJobPayload>(QUEUE_NAMES.WEBHOOK_PAGARME);
    await queue.add(
      'process',
      { webhookRecordId: record.id, orderId, eventType: payload.type },
      {
        priority: JOB_PRIORITY.CRITICAL,
        jobId: `pm-webhook-${record.id}`,
      },
    );
  }

  logger.info({
    event: 'webhook_pagarme_received',
    webhookRecordId: record.id,
    eventType: payload.type,
    orderId,
    enqueued: !!orderId,
  }, 'Webhook Pagar.me received');

  return { data: { success: true, message: 'Webhook recebido' } };
});

/**
 * GET - Health check
 */
export const GET = withApiHandler<WebhookHealthResponse>(async () => ({
  data: { service: 'Pagar.me Webhook', status: 'online' },
}));
