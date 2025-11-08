export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/shipments/:id/payment
 * Atualiza o método e status de pagamento do envio
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { method, status, transactionId, meta } = body;

    if (!method || !status) {
      return NextResponse.json(
        { message: 'method e status são obrigatórios' },
        { status: 400 }
      );
    }

    const { id: shipmentId } = await params;

    // Verificar se o envio existe e pertence ao usuário
    const shipment = await prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        senderId: session.userId,
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { message: 'Envio não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já foi pago (idempotência)
    if (shipment.paymentMethod && shipment.status !== 'pending_payment') {
      return NextResponse.json(
        { code: 'ALREADY_PAID', message: 'Este envio já foi pago' },
        { status: 409 }
      );
    }

    // Determinar novo status do shipment baseado no status do pagamento
    let newShipmentStatus = shipment.status;
    if (status === 'approved') {
      newShipmentStatus = 'ready_for_posting'; // Pronto para postagem
    } else if (status === 'failed') {
      newShipmentStatus = 'payment_failed'; // Falha no pagamento
    }

    // Atualizar envio
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        paymentMethod: method,
        status: newShipmentStatus,
        // Podemos adicionar mais campos conforme necessário
      },
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

    // Se pagamento aprovado, marcar carrinho como CHECKED_OUT
    if (status === 'approved') {
      // Buscar carrinho LOCKED que contém este shipment nos metadados
      const cart = await prisma.cart.findFirst({
        where: {
          userId: session.userId,
          status: 'LOCKED',
        },
      });

      if (cart && cart.meta) {
        const cartMeta = cart.meta as { shipmentIds?: string[]; [key: string]: unknown };
        if (cartMeta.shipmentIds?.includes(shipmentId)) {
          // Verificar se todos os shipments do carrinho foram pagos
          const allShipments = await prisma.shipment.findMany({
            where: {
              id: { in: cartMeta.shipmentIds },
            },
          });

          const allPaid = allShipments.every(
            (s) => s.paymentMethod && s.status !== 'pending_payment'
          );

          if (allPaid) {
            // Marcar carrinho como CHECKED_OUT e remover itens
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

    return NextResponse.json({
      success: true,
      shipment: {
        id: updatedShipment.id,
        status: updatedShipment.status,
        paymentMethod: updatedShipment.paymentMethod,
      },
    });
  } catch (error) {
    console.error('[SHIPMENT_PAYMENT_UPDATE]', error);
    return NextResponse.json(
      { message: 'Erro ao atualizar pagamento' },
      { status: 500 }
    );
  }
}
