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
    const { method, status, meta } = body;

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
    // Nota: Só alteramos status se pagamento falhar. Status aprovado mantém o status atual do fluxo.
    const dataToUpdate: { paymentMethod: string; status?: string } = {
      paymentMethod: method,
    };

    if (status === 'failed') {
      dataToUpdate.status = 'CANCELLED_BEFORE_HANDOFF'; // Cancelado por falha no pagamento
    }
    // Se status === 'approved', mantém o status atual (não sobrescreve)

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

      if (label && label.status === 'pending') {
        // Mock PDF para label (mesmo usado em /api/wallet/debit)
        const mockPdfBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvVGltZXMtUm9tYW4+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNDQ+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEV0aXF1ZXRhIFRlc3RlKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0NSAwMDAwMCBuIAowMDAwMDAwMzI4IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDIwCiUlRU9GCg==';

        await prisma.label.update({
          where: { id: label.id },
          data: {
            status: 'issued',
            fileBase64: mockPdfBase64,
            contentType: 'application/pdf',
            sizeBytes: 420,
          },
        });
      }
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
