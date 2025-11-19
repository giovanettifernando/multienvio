export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSessionFromRequest } from "@/lib/auth/user-session";
import { ShipmentStatus, FINAL_STATUSES } from "@/lib/shipments/shipment-status";
import { canBeCancelled, getNextCancellationStatus } from "@/lib/shipments/status-migration";

/**
 * POST /api/shipments/[id]/cancel
 * Cancela um shipment seguindo as regras do novo modelo de status
 * - Se ainda não foi entregue à transportadora: CANCELLED_BEFORE_HANDOFF
 * - Se já está em trânsito: CANCELLATION_REQUESTED_IN_TRANSIT
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

    const currentStatus = shipment.status as ShipmentStatus;

    // Verificar se está em status final (não pode ser cancelado)
    if ((FINAL_STATUSES as readonly ShipmentStatus[]).includes(currentStatus)) {
      return NextResponse.json(
        { message: 'Este envio já está finalizado e não pode ser cancelado' },
        { status: 400 }
      );
    }

    // Verificar se pode ser cancelado
    if (!canBeCancelled(currentStatus)) {
      return NextResponse.json(
        { message: 'Não é possível cancelar este envio no status atual' },
        { status: 400 }
      );
    }

    // Determinar próximo status de cancelamento
    const nextCancellationStatus = getNextCancellationStatus(currentStatus);

    if (!nextCancellationStatus) {
      return NextResponse.json(
        { message: 'Erro ao determinar status de cancelamento' },
        { status: 500 }
      );
    }

    // Cancelar shipment, label e pickup em uma transação
    await prisma.$transaction(async (tx) => {
      // Atualizar status do shipment
      await tx.shipment.update({
        where: { id },
        data: { status: nextCancellationStatus },
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

    // Mensagem baseada no tipo de cancelamento
    const message = nextCancellationStatus === ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF
      ? 'Envio cancelado com sucesso'
      : 'Solicitação de cancelamento registrada. A transportadora será notificada.';

    return NextResponse.json({
      ok: true,
      message,
      newStatus: nextCancellationStatus,
    });
  } catch (error) {
    console.error('[SHIPMENT_CANCEL]', error);
    const message = error instanceof Error ? error.message : 'Erro ao cancelar envio';
    return NextResponse.json({ message }, { status: 500 });
  }
}
