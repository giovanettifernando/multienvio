/**
 * POST /api/admin/integrations/mercadopago/test-webhook
 *
 * Testa se o webhook do Mercado Pago está configurado corretamente.
 * Verifica configuração do gateway e queue sem fazer self-fetch HTTP.
 */

import { AdminPermission } from '@prisma/client';
import { requireAdminSession } from '@/platform/auth/require-session';
import { isMercadoPagoConfigured } from '@/platform/integrations/mercadopago';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { getQueue, QUEUE_NAMES } from '@/platform/queue';

/**
 * POST - Testa configuração do webhook do Mercado Pago
 */
type TestResult = {
  ok: boolean;
  message: string;
  details: Record<string, unknown>;
};

export const POST = withApiHandler<TestResult>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.INTEGRACOES);

  // 1. Verificar se MP está configurado (credenciais)
  const isConfigured = await isMercadoPagoConfigured();
  if (!isConfigured) {
    throw new ApiError({
      code: 'NOT_CONFIGURED',
      message: 'Mercado Pago não configurado',
      status: 400,
    });
  }

  // 2. Verificar se o gateway existe no banco
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago', status: 'ACTIVE' },
  });

  if (!gateway) {
    return {
      data: {
        ok: false,
        message: 'Gateway Mercado Pago não encontrado ou inativo no banco de dados',
        details: { step: 'gateway_check' },
      },
    };
  }

  // 3. Verificar se a queue está acessível
  try {
    const queue = getQueue(QUEUE_NAMES.WEBHOOK_MERCADOPAGO);
    const isPaused = await queue.isPaused();
    if (isPaused) {
      return {
        data: {
          ok: false,
          message: 'Fila de webhooks está pausada',
          details: { step: 'queue_check', paused: true },
        },
      };
    }
  } catch (queueError) {
    return {
      data: {
        ok: false,
        message: 'Não foi possível acessar a fila de webhooks',
        details: {
          step: 'queue_check',
          error: queueError instanceof Error ? queueError.message : 'Erro desconhecido',
        },
      },
    };
  }

  return {
    data: {
      ok: true,
      message: 'Webhook configurado corretamente: gateway ativo, fila operacional',
      details: {
        gatewayId: gateway.id,
        gatewayStatus: gateway.status,
      },
    },
  };
});
