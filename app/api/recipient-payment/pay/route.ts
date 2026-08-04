/**
 * POST /api/recipient-payment/pay
 *
 * Processa o pagamento pelo destinatario
 * Endpoint publico - nao requer autenticacao
 *
 * IMPORTANTE: como não há sessão de usuário, o `transactionId` (PaymentTransaction
 * do Asaas criada por /create-payment) é o único jeito de provar que este link
 * de pagamento foi realmente pago antes de liberar o Shipment. O gate completo
 * (status que libera serviço, vínculo com este RecipientPaymentRequest, valor
 * suficiente e anti-reuso) fica em processRecipientPayment.
 *
 * Somente após o gate aprovar:
 * 1. Cria o Shipment real na tabela shipments
 * 2. Marca o RecipientPaymentRequest como PAID
 * 3. Envia e-mails de confirmacao
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { z } from 'zod';
import { processRecipientPayment, getRequestByToken } from '@/modules/recipients/application/service';
import {
  sendRecipientPaymentConfirmedEmail,
  sendSenderPaymentReceivedEmail,
} from '@/platform/email/recipient-payment';
import { prisma } from '@/platform/db/db';

const paymentSchema = z.object({
  paymentToken: z.string().min(1, 'Token de pagamento e obrigatorio'),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD', 'BOLETO']),
  // Id da PaymentTransaction (Asaas) criada por /create-payment. Este endpoint
  // é público (sem sessão de usuário) — a transação é o único jeito de provar
  // que o pagamento aconteceu antes de criar o Shipment. Ver o gate completo
  // em processRecipientPayment (modules/recipients/application/service.ts).
  // TODO(Task 14/15 - frontend): RecipientPaymentModal.tsx ainda envia o campo
  // antigo `mercadoPagoPaymentId` em vez de `transactionId` — o fluxo via UI
  // recebe 400 (campo obrigatório ausente) até o modal ser atualizado para
  // enviar o id real da PaymentTransaction retornado por /create-payment.
  transactionId: z.string().min(1, 'Id da transação de pagamento e obrigatorio'),
});

type PayResponse = {
  success: boolean;
  shipmentId?: string;
  trackingCode?: string;
  error?: string;
};

export const POST = withApiHandler<PayResponse>(async (context) => {
  // Validar payload
  const body = await context.req.json();
  const parsed = paymentSchema.safeParse(body);

  if (!parsed.success) {
    throw ApiError.validation('Dados invalidos', parsed.error.flatten());
  }

  const { paymentToken, paymentMethod, transactionId } = parsed.data;

  // Buscar request para validacao
  const request = await getRequestByToken(paymentToken);
  if (!request) {
    throw ApiError.notFound('Solicitacao nao encontrada');
  }

  // Verificar status
  if (request.status === 'PAID') {
    return {
      data: {
        success: true,
        shipmentId: undefined, // Ja foi processado
        trackingCode: undefined,
      },
    };
  }

  if (request.status === 'CANCELLED') {
    throw ApiError.badRequest('Esta solicitacao foi cancelada');
  }

  if (request.status === 'EXPIRED' || new Date() > request.expiresAt) {
    throw ApiError.badRequest('Esta solicitacao expirou');
  }

  // Processar pagamento e criar shipment.
  // O gate real (transação existe, status libera serviço, pertence a ESTE
  // link, valor cobre o total e não foi reaproveitada) acontece dentro de
  // processRecipientPayment — sem ele, este endpoint público criaria o
  // shipment para qualquer requisição com um paymentToken válido, pago ou não.
  const result = await processRecipientPayment(paymentToken, paymentMethod, transactionId);

  if (!result.success) {
    throw ApiError.badRequest(result.error || 'Erro ao processar pagamento');
  }

  // Buscar dados completos do request para os e-mails
  const fullRequest = await prisma.recipientPaymentRequest.findUnique({
    where: { paymentToken },
    include: {
      sender: {
        select: {
          name: true,
          razaoSocial: true,
          email: true,
        },
      },
    },
  });

  if (fullRequest && result.platformTrackingCode) {
    // Enviar e-mail de confirmacao para o destinatario
    await sendRecipientPaymentConfirmedEmail({
      recipientName: fullRequest.recipientName,
      recipientEmail: fullRequest.recipientEmail,
      senderName: fullRequest.sender.razaoSocial || fullRequest.sender.name,
      trackingCode: result.platformTrackingCode,
      publicTrackingId: result.publicTrackingId,
      totalCents: fullRequest.totalCents,
      originCity: fullRequest.originCity,
      originState: fullRequest.originState,
      destinationCity: fullRequest.destinationCity,
      destinationState: fullRequest.destinationState,
      carrier: fullRequest.carrier,
      service: fullRequest.service,
      estimatedDays: fullRequest.estimatedDays,
    });

    // Enviar e-mail para o remetente notificando do pagamento
    await sendSenderPaymentReceivedEmail({
      senderEmail: fullRequest.sender.email,
      senderName: fullRequest.sender.razaoSocial || fullRequest.sender.name,
      recipientName: fullRequest.recipientName,
      trackingCode: result.platformTrackingCode,
      totalCents: fullRequest.totalCents,
      destinationCity: fullRequest.destinationCity,
      destinationState: fullRequest.destinationState,
    });
  }

  return {
    data: {
      success: true,
      shipmentId: result.shipmentId,
      trackingCode: result.platformTrackingCode,
    },
  };
});
