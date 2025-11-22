/**
 * Serviço de webhooks do Mercado Pago
 *
 * Responsável por:
 * - Validar assinatura HMAC-SHA256
 * - Processar notificações de pagamento
 * - Registrar webhooks no banco (PaymentWebhook)
 *
 * Referência: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getMercadoPagoConfig } from './config';
import { updatePaymentFromMercadoPago } from './payments';
import type { MercadoPagoWebhookPayload, WebhookHeaders } from './types';

/**
 * Valida assinatura HMAC-SHA256 do webhook
 *
 * Formato do header x-signature:
 * ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839
 *
 * Manifest string:
 * id:[data.id];request-id:[x-request-id];ts:[ts];
 *
 * @param payload Payload do webhook
 * @param headers Headers do webhook
 * @returns true se válido, false caso contrário
 */
export async function validateWebhookSignature(
  payload: MercadoPagoWebhookPayload,
  headers: WebhookHeaders
): Promise<boolean> {
  const xSignature = headers['x-signature'];
  const xRequestId = headers['x-request-id'];

  if (!xSignature || !xRequestId) {
    console.warn('[MERCADO_PAGO_WEBHOOK] Headers de assinatura ausentes');
    return false;
  }

  // Buscar webhookSecret da configuração
  const config = await getMercadoPagoConfig();

  if (!config?.webhookSecret) {
    console.warn('[MERCADO_PAGO_WEBHOOK] Webhook secret não configurado, pulando validação');
    // Por segurança, retornar false se não tiver secret configurado
    // Em desenvolvimento, você pode mudar para true para facilitar testes
    return process.env.NODE_ENV === 'development';
  }

  try {
    // Extrair ts e v1 do header x-signature
    const signatureParts: Record<string, string> = {};
    xSignature.split(',').forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        signatureParts[key] = value;
      }
    });

    const ts = signatureParts.ts;
    const v1 = signatureParts.v1;

    if (!ts || !v1) {
      console.warn('[MERCADO_PAGO_WEBHOOK] Formato de assinatura inválido');
      return false;
    }

    // Construir manifest string
    const dataId = payload.data?.id || '';
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Calcular HMAC-SHA256
    const hmac = crypto.createHmac('sha256', config.webhookSecret);
    hmac.update(manifest);
    const calculatedSignature = hmac.digest('hex');

    // Comparar assinaturas
    const isValid = calculatedSignature === v1;

    if (!isValid) {
      console.warn('[MERCADO_PAGO_WEBHOOK] Assinatura inválida:', {
        expected: v1,
        calculated: calculatedSignature,
      });
    }

    return isValid;
  } catch (error) {
    console.error('[MERCADO_PAGO_WEBHOOK] Erro ao validar assinatura:', error);
    return false;
  }
}

/**
 * Processa webhook do Mercado Pago
 *
 * Fluxo:
 * 1. Valida assinatura
 * 2. Registra webhook no banco (PaymentWebhook)
 * 3. Processa evento (atualiza PaymentTransaction)
 * 4. Aplica efeitos de domínio se necessário
 *
 * @param payload Payload do webhook
 * @param headers Headers do webhook
 * @returns true se processado com sucesso
 */
export async function processWebhook(
  payload: MercadoPagoWebhookPayload,
  headers: WebhookHeaders
): Promise<boolean> {
  // 1. Buscar gateway
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'mercadopago', status: 'ACTIVE' },
  });

  if (!gateway) {
    console.error('[MERCADO_PAGO_WEBHOOK] Gateway não encontrado');
    return false;
  }

  // 2. Registrar webhook no banco
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

  try {
    // 3. Validar assinatura (se configurado)
    const isValid = await validateWebhookSignature(payload, headers);

    if (!isValid) {
      await prisma.paymentWebhook.update({
        where: { id: webhookRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Assinatura inválida',
          processedAt: new Date(),
        },
      });
      return false;
    }

    // 4. Processar apenas eventos de pagamento
    if (payload.type !== 'payment' && !payload.action?.includes('payment')) {
      await prisma.paymentWebhook.update({
        where: { id: webhookRecord.id },
        data: {
          status: 'IGNORED',
          errorMessage: `Tipo de evento não suportado: ${payload.type}`,
          processedAt: new Date(),
        },
      });
      return true; // Não é erro, apenas ignorado
    }

    // 5. Extrair ID do pagamento
    const paymentId = payload.data?.id;

    if (!paymentId) {
      await prisma.paymentWebhook.update({
        where: { id: webhookRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: 'ID do pagamento ausente',
          processedAt: new Date(),
        },
      });
      return false;
    }

    // 6. Atualizar transaction a partir do MP
    try {
      await updatePaymentFromMercadoPago(paymentId);
    } catch (updateError: unknown) {
      const errorObj = updateError as { message?: string };
      const errorMessage = errorObj.message || 'Erro desconhecido';

      // Se o pagamento não existe (404), marcar como IGNORED e retornar sucesso
      // Isso é comum em testes de webhook com IDs fictícios
      if (errorMessage.includes('Payment not found') || errorMessage.includes('not_found')) {
        await prisma.paymentWebhook.update({
          where: { id: webhookRecord.id },
          data: {
            status: 'IGNORED',
            errorMessage: `Pagamento não encontrado no Mercado Pago: ${paymentId}`,
            processedAt: new Date(),
          },
        });

        console.log('[MERCADO_PAGO_WEBHOOK] Pagamento não encontrado (teste de webhook):', paymentId);
        return true; // Retornar sucesso para não reenviar
      }

      // Outros erros devem ser relançados
      throw updateError;
    }

    // 7. Marcar webhook como processado
    await prisma.paymentWebhook.update({
      where: { id: webhookRecord.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    console.log('[MERCADO_PAGO_WEBHOOK] Webhook processado com sucesso:', {
      webhookId: webhookRecord.id,
      paymentId,
      action: payload.action,
    });

    return true;
  } catch (error: unknown) {
    console.error('[MERCADO_PAGO_WEBHOOK] Erro ao processar webhook:', error);

    // Marcar webhook como falhado
    const errorObj = error as { message?: string };
    await prisma.paymentWebhook.update({
      where: { id: webhookRecord.id },
      data: {
        status: 'FAILED',
        errorMessage: errorObj.message || 'Erro desconhecido',
        processedAt: new Date(),
      },
    });

    return false;
  }
}

/**
 * Retry de webhooks falhados
 *
 * Busca webhooks com status FAILED que ainda não atingiram maxRetries
 * e tenta reprocessá-los
 */
export async function retryFailedWebhooks(): Promise<void> {
  const failedWebhooks = await prisma.paymentWebhook.findMany({
    where: {
      status: 'FAILED',
      retryCount: {
        lt: prisma.paymentWebhook.fields.maxRetries,
      },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } },
      ],
    },
    take: 10, // Processar no máximo 10 por vez
    orderBy: {
      createdAt: 'asc',
    },
  });

  for (const webhook of failedWebhooks) {
    try {
      const payload = webhook.payload as unknown as MercadoPagoWebhookPayload;
      const headers: WebhookHeaders = {
        'x-signature': webhook.signature || undefined,
        'x-request-id': webhook.externalId || undefined,
      };

      // Tentar reprocessar
      const success = await processWebhook(payload, headers);

      if (success) {
        console.log('[MERCADO_PAGO_WEBHOOK] Retry bem-sucedido:', webhook.id);
      } else {
        // Incrementar retry count e agendar próximo retry
        const nextRetryAt = new Date();
        nextRetryAt.setMinutes(nextRetryAt.getMinutes() + Math.pow(2, webhook.retryCount + 1)); // Exponential backoff

        await prisma.paymentWebhook.update({
          where: { id: webhook.id },
          data: {
            retryCount: { increment: 1 },
            nextRetryAt,
          },
        });

        console.log('[MERCADO_PAGO_WEBHOOK] Retry agendado para:', nextRetryAt);
      }
    } catch (error) {
      console.error('[MERCADO_PAGO_WEBHOOK] Erro ao processar retry:', error);
    }
  }
}
