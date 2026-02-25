import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { WalletDebitApiSchema } from '@/shared/validation/wallet';
import { sendShipmentTrackingEmail } from '@/platform/email/mailer';
import { logger } from '@/platform/logging/logger';
import { processDebit } from '@/modules/wallet/application';

// Note: prisma still needed for sendTrackingEmailsForShipments helper

/**
 * Resposta da API de débito da carteira
 */
export interface WalletDebitResponse {
  ok: boolean;
  idempotent: boolean;
  balance: number;
  transactionId: string;
  message?: string;
}

/**
 * POST /api/wallet/debit
 * Debita valor da carteira para pagamento de envio (idempotente por referenceId)
 */
export const POST = withApiHandler<WalletDebitResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  const body = await context.req.json();

  // Validar entrada
  const validation = WalletDebitApiSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'wallet_debit_validation_error', errors: validation.error.flatten() }, 'Validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const { shipmentId, referenceId, amount, reason, trackingCode, metadata } = validation.data;

  // Processar débito via service
  const result = await processDebit({
    userId: session.userId,
    shipmentId,
    referenceId,
    amount,
    reason,
    trackingCode,
    metadata,
  });

  // Enviar e-mails de rastreamento (side effect assíncrono)
  if (!result.idempotent && result.shipmentIds && result.shipmentIds.length > 0) {
    sendTrackingEmailsForShipments(session.userId, result.shipmentIds).catch((err) => {
      logger.error({ event: 'tracking_emails_error', err }, 'Failed to send tracking emails after payment');
    });
  }

  return {
    data: {
      ok: result.ok,
      idempotent: result.idempotent,
      balance: result.balance,
      transactionId: result.transactionId,
      ...(result.message && { message: result.message }),
    },
  };
});

/**
 * Envia e-mails de rastreamento para os destinatários dos shipments pagos
 */
async function sendTrackingEmailsForShipments(
  userId: string,
  shipmentIds: string[]
): Promise<void> {
  if (!shipmentIds || shipmentIds.length === 0) return;

  try {
    // Buscar dados do remetente
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, razaoSocial: true },
    });
    const senderName = sender?.razaoSocial || sender?.name || 'Remetente';

    // Buscar shipments com dados do destinatário
    const shipments = await prisma.shipment.findMany({
      where: { id: { in: shipmentIds } },
      select: {
        platformTrackingCode: true,
        publicTrackingId: true,
        recipientName: true,
        recipientEmail: true,
        destinationCity: true,
        destinationState: true,
      },
    });

    // Enviar e-mail para cada shipment que tem e-mail do destinatário
    for (const shipment of shipments) {
      if (!shipment.recipientEmail || shipment.recipientEmail.trim() === '') {
        logger.info({
          event: 'tracking_email_skip',
          trackingCode: shipment.platformTrackingCode,
          reason: 'no_email',
        }, 'Skipping tracking email - no recipient email');
        continue;
      }

      try {
        const sent = await sendShipmentTrackingEmail(
          shipment.recipientEmail,
          shipment.recipientName || 'Destinatário',
          shipment.platformTrackingCode,
          senderName,
          shipment.destinationCity,
          shipment.destinationState,
          shipment.publicTrackingId,
        );

        if (sent) {
          logger.info({
            event: 'tracking_email_sent',
            trackingCode: shipment.platformTrackingCode,
            recipientEmail: shipment.recipientEmail,
          }, 'Tracking email sent to recipient');
        } else {
          logger.warn({
            event: 'tracking_email_failed',
            trackingCode: shipment.platformTrackingCode,
            recipientEmail: shipment.recipientEmail,
          }, 'Failed to send tracking email');
        }
      } catch (emailError) {
        logger.error({
          event: 'tracking_email_error',
          trackingCode: shipment.platformTrackingCode,
          err: emailError,
        }, 'Error sending tracking email');
      }
    }
  } catch (error) {
    logger.error({
      event: 'tracking_emails_batch_error',
      shipmentIds,
      err: error,
    }, 'Error fetching data for tracking emails');
  }
}
