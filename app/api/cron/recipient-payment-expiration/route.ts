/**
 * GET/POST /api/cron/recipient-payment-expiration
 *
 * Cron job para expirar solicitacoes de pagamento pelo destinatario
 *
 * Funcionalidades:
 * - Expira requests pendentes que passaram do prazo (72h)
 * - Envia e-mails de notificacao para destinatarios
 * - Opcionalmente envia lembretes para requests proximos de expirar (24h)
 *
 * Seguranca:
 * - Aceita apenas requisicoes com header X-Cron-Secret valido
 * - Ou requisicoes do Vercel Cron
 *
 * Uso:
 * - Configure um cron job para chamar este endpoint a cada hora
 * - Ex: curl -X POST -H "X-Cron-Secret: $SECRET" https://seusite.com/api/cron/recipient-payment-expiration
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import crypto from 'crypto';
import {
  expirePendingRequests,
  getRequestsExpiringWithin,
} from '@/modules/recipients/application/service';
import {
  sendRecipientPaymentExpiredEmail,
  sendRecipientPaymentReminderEmail,
} from '@/platform/email/recipient-payment';
import { prisma } from '@/platform/db/db';
import { logger } from '@/platform/logging/logger';

export const maxDuration = 60; // 60 segundos de timeout

/**
 * SECURITY: Comparacao constant-time para evitar timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    crypto.timingSafeEqual(aBuffer, Buffer.alloc(aBuffer.length));
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Valida se a requisicao e autorizada
 */
function isAuthorized(headers: Headers): boolean {
  // 1. Verificar secret do cron com comparacao constant-time
  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = headers.get('x-cron-secret');

  if (cronSecret && requestSecret && secureCompare(requestSecret, cronSecret)) {
    return true;
  }

  // 2. Verificar se e Vercel Cron (header especial)
  const vercelCron = headers.get('x-vercel-cron');
  if (vercelCron === '1') {
    return true;
  }

  // 3. Em desenvolvimento, permitir sem autenticacao
  if (process.env.NODE_ENV === 'development') {
    logger.warn({ event: 'recipient_payment_expiration_dev_access' }, 'Allowing dev access without auth');
    return true;
  }

  return false;
}

interface ExpirationResult {
  success: boolean;
  message: string;
  timestamp: string;
  expired: number;
  reminders: number;
  errors: string[];
  duration: number;
}

async function processExpiration(): Promise<ExpirationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let expiredCount = 0;
  let remindersCount = 0;

  try {
    // 1. Expirar requests que passaram do prazo
    const expiredRequests = await expirePendingRequests();
    expiredCount = expiredRequests.length;

    logger.info({
      event: 'recipient_payment_expired',
      count: expiredCount,
    }, `Expired ${expiredCount} recipient payment requests`);

    // 2. Enviar e-mails de expiracao
    for (const request of expiredRequests) {
      try {
        await sendRecipientPaymentExpiredEmail({
          recipientName: request.recipientName,
          recipientEmail: request.recipientEmail,
          senderName: 'Remetente', // Buscar nome do remetente se necessario
          originCity: request.originCity,
          originState: request.originState,
          destinationCity: request.destinationCity,
          destinationState: request.destinationState,
        });
      } catch (emailError) {
        const errorMsg = `Failed to send expiration email to ${request.recipientEmail}`;
        logger.error({ event: 'recipient_payment_email_error', error: emailError, email: request.recipientEmail }, errorMsg);
        errors.push(errorMsg);
      }
    }

    // 3. Enviar lembretes para requests que vao expirar em 24h
    const expiringRequests = await getRequestsExpiringWithin(24);

    for (const request of expiringRequests) {
      try {
        // Buscar nome do remetente
        const sender = await prisma.user.findUnique({
          where: { id: request.senderId },
          select: { name: true, razaoSocial: true },
        });

        const senderName = sender?.razaoSocial || sender?.name || 'Remetente';

        await sendRecipientPaymentReminderEmail({
          recipientName: request.recipientName,
          recipientEmail: request.recipientEmail,
          senderName,
          paymentToken: request.paymentToken,
          expiresAt: request.expiresAt,
          totalCents: request.totalCents,
          originCity: request.originCity,
          originState: request.originState,
          destinationCity: request.destinationCity,
          destinationState: request.destinationState,
        });

        remindersCount++;
      } catch (emailError) {
        const errorMsg = `Failed to send reminder email to ${request.recipientEmail}`;
        logger.error({ event: 'recipient_payment_reminder_error', error: emailError, email: request.recipientEmail }, errorMsg);
        errors.push(errorMsg);
      }
    }

    logger.info({
      event: 'recipient_payment_reminders_sent',
      count: remindersCount,
    }, `Sent ${remindersCount} reminder emails`);

  } catch (error) {
    logger.error({ event: 'recipient_payment_expiration_error', error }, 'Error during expiration process');
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  const duration = Date.now() - startTime;

  return {
    success: errors.length === 0,
    message: `Expired ${expiredCount} requests, sent ${remindersCount} reminders`,
    timestamp: new Date().toISOString(),
    expired: expiredCount,
    reminders: remindersCount,
    errors,
    duration,
  };
}

// GET para facilitar testes manuais
export const GET = withApiHandler<ExpirationResult>(async (context) => {
  // Verificar autorizacao
  if (!isAuthorized(context.req.headers)) {
    throw ApiError.unauthorized('Nao autorizado');
  }

  logger.info({ event: 'recipient_payment_expiration_start' }, 'Starting recipient payment expiration job');

  const result = await processExpiration();

  logger.info({
    event: 'recipient_payment_expiration_complete',
    durationMs: result.duration,
    expired: result.expired,
    reminders: result.reminders,
  }, 'Recipient payment expiration job completed');

  return { data: result };
});

// POST para cron jobs
export const POST = withApiHandler<ExpirationResult>(async (context) => {
  // Verificar autorizacao
  if (!isAuthorized(context.req.headers)) {
    throw ApiError.unauthorized('Nao autorizado');
  }

  logger.info({ event: 'recipient_payment_expiration_start' }, 'Starting recipient payment expiration job');

  const result = await processExpiration();

  logger.info({
    event: 'recipient_payment_expiration_complete',
    durationMs: result.duration,
    expired: result.expired,
    reminders: result.reminders,
  }, 'Recipient payment expiration job completed');

  return { data: result };
});
