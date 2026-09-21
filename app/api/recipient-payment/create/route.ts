/**
 * POST /api/recipient-payment/create
 *
 * Cria uma solicitacao de pagamento pelo destinatario
 * Requer autenticacao - apenas o remetente pode criar
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getSession } from '@/modules/auth/application/session';
import { createRecipientPaymentRequest } from '@/modules/recipients/application/service';
import { validateQuoteAndGetPrice } from '@/modules/cart/application/checkout.service';
import { createRecipientPaymentSchema } from '@/modules/recipients/application/validation';
import { sendRecipientPaymentRequestEmail } from '@/platform/email/recipient-payment';
import { prisma } from '@/platform/db/db';
import type { RecipientPaymentRequestWithPackages } from '@/modules/recipients/application/types';

type CreateResponse = {
  request: RecipientPaymentRequestWithPackages;
  paymentUrl: string;
  emailSent: boolean;
};

export const POST = withApiHandler<CreateResponse>(async (context) => {
  // Autenticacao
  const session = await getSession();
  if (!session) {
    throw ApiError.unauthorized('Nao autenticado');
  }

  // Validar payload
  const body = await context.req.json();
  const parsed = createRecipientPaymentSchema.safeParse(body);

  if (!parsed.success) {
    throw ApiError.validation('Dados invalidos', parsed.error.flatten());
  }

  // Garantir que o senderId seja do usuario logado
  // Preço e serviço saem da cotação salva no servidor (dono e validade
  // conferidos). Sem isso o remetente podia gerar um link de R$ 0,01, pagar ele
  // mesmo e sair com a etiqueta. A comissão é calculada no pagamento.
  const { quote } = parsed.data;
  const cotacao = await validateQuoteAndGetPrice(quote.quoteId, session.userId, quote.totalCents / 100);

  const data = {
    ...parsed.data,
    quote: {
      quoteId: cotacao.quoteId,
      carrier: cotacao.carrier,
      service: cotacao.service,
      serviceCode: cotacao.serviceCode,
      estimatedDays: cotacao.estimatedDays,
      freightCostCents: cotacao.freightCostCents,
      totalCents: cotacao.freightCostCents,
    },
    senderId: session.userId,
  };

  // Criar request
  const request = await createRecipientPaymentRequest(data);

  // Buscar dados do remetente para o e-mail
  const sender = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, razaoSocial: true },
  });

  const senderName = sender?.razaoSocial || sender?.name || 'Remetente';

  // Gerar URL de pagamento
  const baseUrl = process.env.EMAIL_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const paymentUrl = `${baseUrl}/pagar/${request.paymentToken}`;

  // Enviar e-mail para o destinatario
  const emailSent = await sendRecipientPaymentRequestEmail({
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
    carrier: request.carrier,
    service: request.service,
    estimatedDays: request.estimatedDays,
    packagesCount: request.packages.length,
  });

  return {
    data: {
      request,
      paymentUrl,
      emailSent,
    },
    status: 201,
  };
});
