/**
 * POST /api/recipient-payment/resend
 *
 * Reenvia o link de pagamento para o destinatario
 * Reseta o prazo de expiracao
 * Requer autenticacao - apenas o remetente pode reenviar
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getSession } from '@/lib/auth/session';
import { resendPaymentLink } from '@/lib/recipient-payment/service';
import { resendLinkSchema } from '@/lib/recipient-payment/validation';
import { sendRecipientPaymentRequestEmail } from '@/lib/email/recipient-payment';
import { prisma } from '@/lib/db';

type ResendResponse = {
  success: boolean;
  expiresAt: Date;
  emailSent: boolean;
};

export const POST = withApiHandler<ResendResponse>(async (context) => {
  // Autenticacao
  const session = await getSession();
  if (!session) {
    throw ApiError.unauthorized('Nao autenticado');
  }

  // Validar payload
  const body = await context.req.json();
  const parsed = resendLinkSchema.safeParse(body);

  if (!parsed.success) {
    throw ApiError.validation('Dados invalidos', parsed.error.flatten());
  }

  const { requestId } = parsed.data;

  // Reenviar link (reseta expiracao)
  const result = await resendPaymentLink(requestId, session.userId);

  if (!result.success) {
    throw ApiError.badRequest(result.error || 'Erro ao reenviar link');
  }

  // Buscar dados completos do request para reenviar o e-mail
  const request = await prisma.recipientPaymentRequest.findUnique({
    where: { id: requestId },
    include: {
      packages: true,
      sender: {
        select: { name: true, razaoSocial: true },
      },
    },
  });

  if (!request) {
    throw ApiError.notFound('Solicitacao nao encontrada');
  }

  // Reenviar e-mail
  const emailSent = await sendRecipientPaymentRequestEmail({
    recipientName: request.recipientName,
    recipientEmail: request.recipientEmail,
    senderName: request.sender.razaoSocial || request.sender.name,
    paymentToken: request.paymentToken,
    expiresAt: result.expiresAt!,
    totalCents: request.totalCents,
    originCity: request.originCity,
    originState: request.originState,
    destinationCity: request.destinationCity,
    destinationState: request.destinationState,
    carrier: request.carrier,
    service: request.service,
    estimatedDays: request.estimatedDays,
    packagesCount: request.packages.length,
  });

  return {
    data: {
      success: true,
      expiresAt: result.expiresAt!,
      emailSent,
    },
  };
});
