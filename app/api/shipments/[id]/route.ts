export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * DELETE /api/shipments/[id]
 * Deleta um shipment (apenas se ainda não foi pago/processado)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id: shipmentId } = params;

    // Buscar shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json({ message: 'Shipment não encontrado' }, { status: 404 });
    }

    // Verificar se o shipment pertence ao usuário
    if (shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });
    }

    // Verificar se o shipment pode ser deletado
    // Permitir deletar apenas se não tem método de pagamento definido
    if (shipment.paymentMethod) {
      return NextResponse.json(
        { message: 'Não é possível deletar um shipment que já foi pago' },
        { status: 400 }
      );
    }

    // Deletar em transação (cascata: volumes, labels, tracking events)
    await prisma.$transaction([
      // Deletar volumes
      prisma.package.deleteMany({
        where: { shipmentId },
      }),
      // Deletar etiquetas
      prisma.label.deleteMany({
        where: { shipmentId },
      }),
      // Deletar eventos de rastreamento
      prisma.trackingEvent.deleteMany({
        where: { shipmentId },
      }),
      // Deletar shipment
      prisma.shipment.delete({
        where: { id: shipmentId },
      }),
    ]);

    return NextResponse.json({
      message: 'Shipment deletado com sucesso',
      shipmentId,
    });
  } catch (error) {
    console.error('[SHIPMENT_DELETE]', error);
    return NextResponse.json(
      { message: 'Erro ao deletar shipment' },
      { status: 500 }
    );
  }
}
