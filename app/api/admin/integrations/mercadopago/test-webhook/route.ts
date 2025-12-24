/**
 * POST /api/admin/integrations/mercadopago/test-webhook
 *
 * Testa se o webhook do Mercado Pago está configurado corretamente
 */

import { AdminPermission } from '@prisma/client';
import { requireAdminSession } from '@/platform/auth/require-session';
import { isMercadoPagoConfigured } from '@/platform/integrations/mercadopago';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

/**
 * POST - Testa webhook do Mercado Pago
 */
export const POST = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.INTEGRACOES);
  

  // Verificar se está configurado
  const isConfigured = await isMercadoPagoConfigured();

  if (!isConfigured) {
    throw new ApiError({
      code: 'NOT_CONFIGURED',
      message: 'Mercado Pago não configurado',
      status: 400,
    });
  }

  // Enviar payload de teste para o próprio webhook
  const webhookUrl = new URL('/api/webhooks/mercadopago', req.url);

  const testPayload = {
    id: 999999999,
    live_mode: false,
    type: 'test',
    date_created: new Date().toISOString(),
    user_id: 0,
    api_version: 'v1',
    action: 'test.webhook',
    data: {
      id: 'test_payment_id',
    },
  };

  const webhookResponse = await fetch(webhookUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': 'test_admin_webhook',
      'x-signature': 'ts=0,v1=test_signature',
    },
    body: JSON.stringify(testPayload),
  });

  const webhookText = await webhookResponse.text();

  if (webhookResponse.ok) {
    return {
      data: {
        ok: true,
        message: 'Webhook respondeu com sucesso',
        details: {
          status: webhookResponse.status,
          response: webhookText,
        },
      },
    };
  } else {
    return {
      data: {
        ok: false,
        message: `Webhook retornou erro: ${webhookResponse.status}`,
        details: {
          status: webhookResponse.status,
          response: webhookText,
        },
      },
    };
  }
});
