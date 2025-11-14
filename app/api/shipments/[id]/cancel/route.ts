export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSessionFromRequest } from "@/lib/auth/user-session";

/**
 * POST /api/shipments/[id]/cancel
 * Cancela um shipment e atualiza o status da etiqueta para 'canceled'
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Autenticar usuário
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    // Verificar se o shipment pertence ao usuário
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        label: true,
        pickupRequest: true,
      },
    });

    if (!shipment) {
      return NextResponse.json({ message: "Envio não encontrado" }, { status: 404 });
    }

    if (shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se já está cancelado ou entregue
    if (shipment.status === 'cancelled' || shipment.status === 'delivered') {
      return NextResponse.json(
        { message: 'Não é possível cancelar este envio' },
        { status: 400 }
      );
    }

    // Cancelar shipment, label e pickup em uma transação
    await prisma.$transaction(async (tx) => {
      // Atualizar status do shipment
      await tx.shipment.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      // Se houver label associada, marcar como cancelada
      if (shipment.label) {
        await tx.label.update({
          where: { id: shipment.label.id },
          data: { status: 'canceled' },
        });
      }

      // Se houver pickup request associado, marcar como cancelado
      if (shipment.pickupRequest) {
        await tx.pickupRequest.update({
          where: { id: shipment.pickupRequest.id },
          data: { status: 'CANCELED' },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      message: 'Envio cancelado com sucesso',
    });
  } catch (error) {
    console.error('[SHIPMENT_CANCEL]', error);
    const message = error instanceof Error ? error.message : 'Erro ao cancelar envio';
    return NextResponse.json({ message }, { status: 500 });
  }
}
