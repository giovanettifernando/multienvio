import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';
import { shipmentPaymentUpdateSchema } from '@/shared/validation/shipment';
import { logger } from '@/platform/logging/logger';

interface ShipmentPaymentUpdateResponse {
  success: true;
  shipment: {
    id: string;
    status: string;
    paymentMethod: string | null;
  };
}

/**
 * PATCH /api/shipments/:id/payment
 * Atualiza o método e status de pagamento do envio
 */
export const PATCH = withApiHandler<ShipmentPaymentUpdateResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const body = await context.req.json();

  // Validação com Zod
  const validation = shipmentPaymentUpdateSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const { method, status, meta } = validation.data;
  const shipmentId = context.params.id;

  // Verificar se o envio existe e pertence ao usuário
  const shipment = await prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      senderId: session.userId,
    },
  });

  if (!shipment) {
    throw new ApiError({ code: 'not_found', message: 'Envio não encontrado', status: 404 });
  }

  // Verificar se já foi pago (idempotência)
  if (shipment.paymentMethod && shipment.status !== 'pending_payment') {
    throw new ApiError({ code: 'already_paid', message: 'Este envio já foi pago', status: 409 });
  }

  // SECURITY FIX F-02: Validar que o pagamento foi realmente confirmado no servidor
  // O cliente NÃO pode simplesmente enviar status=approved sem comprovação
  if (status === 'approved') {
    if (method === 'wallet') {
      // Para pagamento via carteira, verificar que a transação existe e está CONFIRMED
      if (!meta?.transactionId) {
        logger.warn({
          event: 'payment_approval_no_transaction',
          shipmentId,
          userId: session.userId,
          method,
        }, 'SECURITY: Attempt to approve wallet payment without transaction ID');
        throw new ApiError({
          code: 'INVALID_PAYMENT',
          message: 'ID da transação de pagamento é obrigatório.',
          status: 400,
        });
      }

      // Buscar e validar a transação
      const walletTransaction = await prisma.walletTransaction.findFirst({
        where: {
          id: meta.transactionId,
          wallet: {
            userId: session.userId, // SECURITY: Verificar ownership
          },
        },
        include: {
          wallet: true,
        },
      });

      if (!walletTransaction) {
        logger.warn({
          event: 'payment_approval_invalid_transaction',
          shipmentId,
          userId: session.userId,
          transactionId: meta.transactionId,
        }, 'SECURITY: Attempt to approve payment with invalid/foreign transaction');
        throw new ApiError({
          code: 'INVALID_TRANSACTION',
          message: 'Transação de pagamento inválida ou não pertence ao usuário.',
          status: 400,
        });
      }

      // A transação já deve estar CONFIRMED (o débito deve ter acontecido antes)
      if (walletTransaction.status !== 'CONFIRMED') {
        logger.warn({
          event: 'payment_approval_unconfirmed_transaction',
          shipmentId,
          userId: session.userId,
          transactionId: meta.transactionId,
          transactionStatus: walletTransaction.status,
        }, 'SECURITY: Attempt to approve payment with unconfirmed transaction');
        throw new ApiError({
          code: 'PAYMENT_NOT_CONFIRMED',
          message: 'O pagamento ainda não foi confirmado.',
          status: 400,
        });
      }

      logger.info({
        event: 'payment_approval_validated',
        shipmentId,
        userId: session.userId,
        transactionId: meta.transactionId,
        method: 'wallet',
      }, 'Payment approval validated via wallet transaction');

    } else if (method === 'pix' || method === 'credit_card' || method === 'boleto') {
      // Para pagamentos via gateway (PIX, cartão, boleto), verificar se existe PaymentTransaction aprovada
      const paymentTransaction = await prisma.paymentTransaction.findFirst({
        where: {
          userId: session.userId,
          status: { in: ['PAID', 'CAPTURED'] }, // Status de pagamento confirmado
          metadata: {
            path: ['shipmentId'],
            equals: shipmentId,
          },
        },
      });

      // Também verificar por shipmentIds (batch)
      const batchPaymentTransaction = !paymentTransaction ? await prisma.paymentTransaction.findFirst({
        where: {
          userId: session.userId,
          status: { in: ['PAID', 'CAPTURED'] },
          metadata: {
            path: ['shipmentIds'],
            array_contains: [shipmentId],
          },
        },
      }) : null;

      if (!paymentTransaction && !batchPaymentTransaction) {
        logger.warn({
          event: 'payment_approval_no_gateway_transaction',
          shipmentId,
          userId: session.userId,
          method,
        }, 'SECURITY: Attempt to approve gateway payment without valid transaction');
        throw new ApiError({
          code: 'PAYMENT_NOT_FOUND',
          message: 'Nenhum pagamento aprovado encontrado para este envio.',
          status: 400,
        });
      }

      logger.info({
        event: 'payment_approval_validated',
        shipmentId,
        userId: session.userId,
        transactionId: (paymentTransaction || batchPaymentTransaction)?.id,
        method,
      }, 'Payment approval validated via gateway transaction');
    } else {
      // Método de pagamento desconhecido
      logger.warn({
        event: 'payment_approval_unknown_method',
        shipmentId,
        userId: session.userId,
        method,
      }, 'SECURITY: Attempt to approve payment with unknown method');
      throw new ApiError({
        code: 'INVALID_PAYMENT_METHOD',
        message: 'Método de pagamento inválido.',
        status: 400,
      });
    }
  }

  // Determinar novo status do shipment baseado no status do pagamento
  const dataToUpdate: { paymentMethod: string; status?: string } = {
    paymentMethod: method,
  };

  if (status === 'failed') {
    dataToUpdate.status = 'CANCELLED_BEFORE_HANDOFF';
  }

  // Atualizar envio
  const updatedShipment = await prisma.shipment.update({
    where: { id: shipmentId },
    data: dataToUpdate,
  });

  // NOTA: Não atualizamos mais a transação aqui - ela já deve estar CONFIRMED
  // A validação acima garante que só chegamos aqui se o pagamento já foi processado

  // Se pagamento aprovado, emitir label
  if (status === 'approved') {
    const label = await prisma.label.findUnique({
      where: { shipmentId },
    });

    // Marcar label como emitida (PDF é baixado on-demand via /api/labels/[id]/pdf)
    if (label && label.status === 'pending') {
      await prisma.label.update({
        where: { id: label.id },
        data: {
          status: 'issued',
        },
      });
    }
  }

  // Se pagamento aprovado, marcar carrinho como CHECKED_OUT
  if (status === 'approved') {
    const cart = await prisma.cart.findFirst({
      where: {
        userId: session.userId,
        status: 'LOCKED',
      },
    });

    if (cart && cart.meta) {
      const cartMeta = cart.meta as { shipmentIds?: string[]; [key: string]: unknown };
      if (cartMeta.shipmentIds?.includes(shipmentId)) {
        const allShipments = await prisma.shipment.findMany({
          where: {
            id: { in: cartMeta.shipmentIds },
          },
        });

        const allPaid = allShipments.every(
          (s) => s.paymentMethod && s.status !== 'pending_payment'
        );

        if (allPaid) {
          await prisma.cartItem.deleteMany({
            where: { cartId: cart.id },
          });

          await prisma.cart.update({
            where: { id: cart.id },
            data: {
              status: 'CHECKED_OUT',
              updatedAt: new Date(),
            },
          });
        }
      }
    }
  }

  return {
    data: {
      success: true,
      shipment: {
        id: updatedShipment.id,
        status: updatedShipment.status,
        paymentMethod: updatedShipment.paymentMethod,
      },
    },
  };
});
