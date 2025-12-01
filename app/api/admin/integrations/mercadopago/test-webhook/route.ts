/**
 * POST /api/admin/integrations/mercadopago/test-webhook
 *
 * Testa se o webhook do Mercado Pago está configurado corretamente
 */


import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { isMercadoPagoConfigured } from '@/lib/mercadopago';

/**
 * POST - Testa webhook do Mercado Pago
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Verificar se está configurado
    const isConfigured = await isMercadoPagoConfigured();

    if (!isConfigured) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Mercado Pago não configurado',
        },
        { status: 400 }
      );
    }

    // Enviar payload de teste para o próprio webhook
    const webhookUrl = new URL('/api/webhooks/mercadopago', request.url);

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
      return NextResponse.json({
        ok: true,
        message: 'Webhook respondeu com sucesso',
        details: {
          status: webhookResponse.status,
          response: webhookText,
        },
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          message: `Webhook retornou erro: ${webhookResponse.status}`,
          details: {
            status: webhookResponse.status,
            response: webhookText,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[ADMIN_MERCADOPAGO_TEST_WEBHOOK]', error);
    const message = error instanceof Error ? error.message : 'Erro ao testar webhook';
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}
