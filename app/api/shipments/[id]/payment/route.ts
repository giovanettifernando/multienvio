import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { shipmentPaymentUpdateSchema } from '@/lib/validation/shipment';

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

  // Se o pagamento foi aprovado e temos uma transação de wallet, confirmar
  if (status === 'approved' && method === 'wallet' && meta?.transactionId) {
    await prisma.walletTransaction.update({
      where: { id: meta.transactionId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });
  }

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
