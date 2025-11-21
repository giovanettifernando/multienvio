/**
 * POST /api/webhooks/mercadopago
 *
 * Webhook para receber notificações do Mercado Pago
 *
 * Referência: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { processWebhook } from '@/lib/mercadopago';
import type { MercadoPagoWebhookPayload, WebhookHeaders } from '@/lib/mercadopago';

/**
 * POST - Recebe notificações do Mercado Pago
 *
 * IMPORTANTE: Este endpoint é público (sem autenticação) pois será chamado pelo Mercado Pago.
 * A validação de autenticidade é feita via assinatura HMAC-SHA256.
 */
export async function POST(request: Request) {
  try {
    // Extrair headers necessários
    const headers: WebhookHeaders = {
      'x-signature': request.headers.get('x-signature') || undefined,
      'x-request-id': request.headers.get('x-request-id') || undefined,
    };

    // Log de recebimento (sem dados sensíveis)
    console.log('[WEBHOOK_MERCADOPAGO] Recebida notificação:', {
      hasSignature: !!headers['x-signature'],
      hasRequestId: !!headers['x-request-id'],
      timestamp: new Date().toISOString(),
    });

    // Parse payload
    const payload: MercadoPagoWebhookPayload = await request.json();

    console.log('[WEBHOOK_MERCADOPAGO] Payload:', {
      id: payload.id,
      type: payload.type,
      action: payload.action,
      dataId: payload.data?.id,
    });

    // Processar webhook
    const success = await processWebhook(payload, headers);

    if (success) {
      // Retornar 200 OK para o Mercado Pago
      return NextResponse.json(
        {
          success: true,
          message: 'Webhook processado com sucesso',
        },
        { status: 200 }
      );
    } else {
      // Retornar 400 para indicar que não devem reenviar
      return NextResponse.json(
        {
          success: false,
          message: 'Webhook não pôde ser processado',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[WEBHOOK_MERCADOPAGO] Erro ao processar webhook:', error);

    // Retornar 500 para indicar erro temporário
    // O Mercado Pago vai tentar reenviar
    return NextResponse.json(
      {
        success: false,
        message: 'Erro interno ao processar webhook',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Health check (não usado pelo MP, apenas para testes)
 */
export async function GET() {
  return NextResponse.json({
    service: 'Mercado Pago Webhook',
    status: 'online',
    timestamp: new Date().toISOString(),
  });
}
