
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import { chargeAdditionalPickupFee } from '@/lib/services/additionalPickupFee';

interface RegisterAttemptBody {
  notes?: string;
}

/**
 * POST /api/coletores/coletas/[id]/registrar-tentativa
 * Registra uma tentativa de coleta sem sucesso
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validar autenticação
    const session = await getAutonomousCollectorSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    // Validar dados do body
    const body: RegisterAttemptBody = await request.json();
    const { notes } = body;

    // Buscar pickup request com dados do shipment
    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id },
      select: {
        id: true,
        collectorId: true,
        status: true,
        attemptCount: true,
        attemptNotes: true,
        userId: true,
        shipmentId: true,
        originCep: true,
      },
    });

    if (!pickupRequest) {
      return NextResponse.json({ message: 'Coleta não encontrada' }, { status: 404 });
    }

    // Validar que a coleta pertence ao coletor logado
    if (pickupRequest.collectorId !== session.coletorId) {
      return NextResponse.json(
        { message: 'Esta coleta não está atribuída a você' },
        { status: 403 }
      );
    }

    // Validar que a coleta está pendente ou agendada
    if (!['PENDING', 'SCHEDULED'].includes(pickupRequest.status)) {
      return NextResponse.json(
        { message: `Coleta já foi processada (status: ${pickupRequest.status})` },
        { status: 400 }
      );
    }

    const now = new Date();

    // Preparar histórico de tentativas
    const currentAttempts = Array.isArray(pickupRequest.attemptNotes)
      ? pickupRequest.attemptNotes
      : [];

    const newAttemptCount = pickupRequest.attemptCount + 1;

    const newAttempt = {
      attemptNumber: newAttemptCount,
      attemptedAt: now.toISOString(),
      notes: notes?.trim() || null,
      collectorId: session.coletorId,
      collectorName: session.pfNome,
    };

    const updatedAttempts = [...currentAttempts, newAttempt];

    // Definir limite de tentativas antes de marcar como FAILED
    const MAX_ATTEMPTS = 3;
    const shouldMarkAsFailed = newAttemptCount >= MAX_ATTEMPTS;

    // Atualizar pickup request e shipment em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar PickupRequest
      const updatedPickupRequest = await tx.pickupRequest.update({
        where: { id },
        data: {
          attemptCount: newAttemptCount,
          attemptNotes: updatedAttempts,
          status: shouldMarkAsFailed ? 'FAILED' : pickupRequest.status,
          updatedAt: now,
        },
        select: {
          id: true,
          status: true,
          attemptCount: true,
          attemptNotes: true,
          shipmentId: true,
        },
      });

      // 2. Se atingiu limite de tentativas, atualizar Shipment.status para PICKUP_FAILED
      if (shouldMarkAsFailed) {
        await tx.shipment.update({
          where: { id: updatedPickupRequest.shipmentId },
          data: {
            status: ShipmentStatus.PICKUP_FAILED,
          },
        });
      }

      return updatedPickupRequest;
    });

    console.log('[REGISTRAR_TENTATIVA] Tentativa de coleta registrada:', {
      pickupId: id,
      collectorId: session.coletorId,
      attemptNumber: result.attemptCount,
      notes: notes || '(sem observação)',
      attemptedAt: now.toISOString(),
      markedAsFailed: shouldMarkAsFailed,
      shipmentStatus: shouldMarkAsFailed ? ShipmentStatus.PICKUP_FAILED : 'unchanged',
    });

    // 3. Cobrar taxa adicional de coleta do usuário
    let chargeResult = null;
    if (pickupRequest.userId && pickupRequest.originCep) {
      try {
        chargeResult = await chargeAdditionalPickupFee({
          pickupRequestId: id,
          userId: pickupRequest.userId,
          shipmentId: result.shipmentId,
          attemptNumber: newAttemptCount,
          originCep: pickupRequest.originCep,
        });

        console.log('[REGISTRAR_TENTATIVA] Taxa adicional cobrada:', {
          method: chargeResult.method,
          amountCents: chargeResult.amountCents,
          newBalance: chargeResult.newBalanceCents,
        });
      } catch (chargeError) {
        // Não bloquear o registro da tentativa se a cobrança falhar
        console.error('[REGISTRAR_TENTATIVA] Erro ao cobrar taxa adicional:', chargeError);
      }
    }

    const message = shouldMarkAsFailed
      ? `Tentativa ${result.attemptCount} registrada. Coleta marcada como falhou após ${MAX_ATTEMPTS} tentativas.`
      : 'Tentativa de coleta registrada com sucesso';

    return NextResponse.json({
      message,
      pickup: {
        id: result.id,
        status: result.status,
        attemptCount: result.attemptCount,
        attemptNotes: result.attemptNotes,
      },
      additionalFeeCharged: chargeResult ? {
        success: chargeResult.success,
        method: chargeResult.method,
        amountCents: chargeResult.amountCents,
        message: chargeResult.message,
      } : null,
    }, { status: 200 });
  } catch (error) {
    console.error('[REGISTRAR_TENTATIVA_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Erro ao registrar tentativa';
    return NextResponse.json({ message }, { status: 500 });
  }
}
