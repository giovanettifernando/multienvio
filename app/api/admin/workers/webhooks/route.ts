/**
 * GET  /api/admin/workers/webhooks — Lista webhooks falhados
 * POST /api/admin/workers/webhooks — Retry de webhooks falhados (re-enfileira no BullMQ)
 *
 * Protegido por autenticação admin com permissão INTEGRACOES.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { getQueue, QUEUE_NAMES, JOB_PRIORITY } from '@/platform/queue';
import type { AsaasWebhookJobData } from '@/platform/queue/types';

export const dynamic = 'force-dynamic';

// ============================================================================
// Types
// ============================================================================

interface WebhookRecord {
  id: string;
  eventType: string | null;
  externalId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
}

interface WebhookListResponse {
  webhooks: WebhookRecord[];
  total: number;
}

interface WebhookRetryResponse {
  success: boolean;
  message: string;
  retriedCount: number;
}

// ============================================================================
// GET — Lista webhooks falhados
// ============================================================================

export const GET = withApiHandler<WebhookListResponse>(async (context) => {
  await requireAdminSession(context.req, AdminPermission.INTEGRACOES);

  const url = new URL(context.req.url);
  const status = url.searchParams.get('status') || 'FAILED';
  const page = parseInt(url.searchParams.get('page') || '0', 10);
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '50', 10), 100);

  const [webhooks, total] = await Promise.all([
    prisma.paymentWebhook.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      skip: page * pageSize,
      take: pageSize,
      select: {
        id: true,
        eventType: true,
        externalId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        errorMessage: true,
      },
    }),
    prisma.paymentWebhook.count({ where: { status } }),
  ]);

  return {
    data: {
      webhooks: webhooks.map((w) => ({
        id: w.id,
        eventType: w.eventType,
        externalId: w.externalId,
        status: w.status,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
        errorMessage: w.errorMessage,
      })),
      total,
    },
  };
});

// ============================================================================
// POST — Retry de webhooks falhados
// ============================================================================

export const POST = withApiHandler<WebhookRetryResponse>(async (context) => {
  await requireAdminSession(context.req, AdminPermission.INTEGRACOES);

  let body: { action?: string; webhookIds?: string[] };
  try {
    body = await context.req.json();
  } catch {
    throw ApiError.badRequest('JSON inválido');
  }

  const { action, webhookIds } = body;

  if (action !== 'retry') {
    throw ApiError.badRequest('Ação inválida. Use: retry');
  }

  if (!webhookIds || webhookIds.length === 0) {
    throw ApiError.badRequest('Campo "webhookIds" é obrigatório');
  }

  // Limitar a 50 por vez
  const ids = webhookIds.slice(0, 50);

  // Buscar webhooks falhados
  const failedWebhooks = await prisma.paymentWebhook.findMany({
    where: {
      id: { in: ids },
      status: 'FAILED',
    },
    select: {
      id: true,
      externalId: true,
      eventType: true,
    },
  });

  if (failedWebhooks.length === 0) {
    throw ApiError.badRequest('Nenhum webhook falhado encontrado com os IDs informados');
  }

  // Marcar como PENDING e re-enfileirar
  const queue = getQueue<AsaasWebhookJobData>(QUEUE_NAMES.WEBHOOK_ASAAS);
  let retriedCount = 0;

  for (const webhook of failedWebhooks) {
    // Resetar status para PENDING
    await prisma.paymentWebhook.update({
      where: { id: webhook.id },
      data: {
        status: 'PENDING',
        errorMessage: null,
      },
    });

    // chargeId e event já ficam gravados no próprio registro (externalId /
    // eventType) — não precisam ser reextraídos do payload bruto.
    const chargeId = webhook.externalId ?? '';
    const event = webhook.eventType ?? '';

    // Re-enfileirar no BullMQ com jobId único de retry — não reutiliza o
    // jobId determinístico de enqueueAsaasWebhook (chargeId+event) porque o
    // job original com esse mesmo ID pode ainda existir na fila (falhado).
    await queue.add(
      'process',
      {
        chargeId,
        event,
      },
      {
        priority: JOB_PRIORITY.HIGH,
        jobId: `asaas-webhook-retry-${webhook.id}-${Date.now()}`,
      }
    );

    retriedCount++;
  }

  return {
    data: {
      success: true,
      message: `${retriedCount} webhook(s) re-enfileirado(s) para processamento`,
      retriedCount,
    },
  };
});
