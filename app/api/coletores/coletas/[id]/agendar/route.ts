
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';

interface SchedulePickupBody {
  scheduleAt: string; // ISO 8601 datetime string
}

/**
 * Valida a data de agendamento de acordo com as regras de tolerância
 */
function validateScheduleDate(createdAt: Date, scheduleAt: Date): {
  valid: boolean;
  message?: string;
} {
  const now = new Date();
  const threeDaysAfterCreation = new Date(createdAt);
  threeDaysAfterCreation.setDate(threeDaysAfterCreation.getDate() + 3);

  // Verificar se a coleta está dentro do prazo (até 3 dias após criação)
  if (now <= threeDaysAfterCreation) {
    // Regra 1: scheduleAt deve estar entre createdAt e createdAt + 3 dias
    if (scheduleAt < createdAt) {
      return {
        valid: false,
        message: 'A data da coleta não pode ser anterior à data de criação do envio.',
      };
    }

    if (scheduleAt > threeDaysAfterCreation) {
      return {
        valid: false,
        message: 'A data da coleta não pode exceder 3 dias após a criação do envio.',
      };
    }

    return { valid: true };
  } else {
    // Regra 2: Coleta atrasada - scheduleAt deve estar entre now e now + 1 dia
    if (scheduleAt < now) {
      return {
        valid: false,
        message: 'A data da coleta não pode ser anterior ao momento atual (coleta atrasada).',
      };
    }

    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    if (scheduleAt > oneDayFromNow) {
      return {
        valid: false,
        message: 'Para coletas atrasadas, a data da coleta não pode exceder 1 dia a partir de agora.',
      };
    }

    return { valid: true };
  }
}

/**
 * PATCH /api/coletores/coletas/[id]/agendar
 * Atualiza a data/hora de agendamento da coleta
 */
export async function PATCH(
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
    const body: SchedulePickupBody = await request.json();
    const { scheduleAt: scheduleAtString } = body;

    if (!scheduleAtString) {
      return NextResponse.json(
        { message: 'Data de agendamento é obrigatória' },
        { status: 400 }
      );
    }

    const scheduleAt = new Date(scheduleAtString);
    if (isNaN(scheduleAt.getTime())) {
      return NextResponse.json(
        { message: 'Data de agendamento inválida' },
        { status: 400 }
      );
    }

    // Buscar pickup request
    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id },
      select: {
        id: true,
        collectorId: true,
        status: true,
        createdAt: true,
        scheduleAt: true,
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

    // Validar que a coleta está pendente
    if (pickupRequest.status !== 'PENDING') {
      return NextResponse.json(
        { message: `Não é possível agendar coleta com status: ${pickupRequest.status}` },
        { status: 400 }
      );
    }

    // Validar data de agendamento de acordo com as regras de tolerância
    const validation = validateScheduleDate(pickupRequest.createdAt, scheduleAt);
    if (!validation.valid) {
      return NextResponse.json(
        { message: validation.message || 'Data de agendamento inválida' },
        { status: 400 }
      );
    }

    // Atualizar pickup request e shipment status em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar PickupRequest com scheduleAt e status SCHEDULED
      const updatedPickupRequest = await tx.pickupRequest.update({
        where: { id },
        data: {
          scheduleAt,
          status: 'SCHEDULED',
          updatedAt: new Date(),
        },
        select: {
          id: true,
          scheduleAt: true,
          status: true,
          shipmentId: true,
        },
      });

      // 2. Atualizar Shipment.status para PICKUP_SCHEDULED
      await tx.shipment.update({
        where: { id: updatedPickupRequest.shipmentId },
        data: {
          status: ShipmentStatus.PICKUP_SCHEDULED,
        },
      });

      return updatedPickupRequest;
    });

    console.log('[AGENDAR_COLETA] Coleta agendada:', {
      pickupId: id,
      collectorId: session.coletorId,
      scheduleAt: scheduleAt.toISOString(),
      shipmentStatus: ShipmentStatus.PICKUP_SCHEDULED,
    });

    return NextResponse.json({
      message: 'Coleta agendada com sucesso',
      pickup: {
        id: result.id,
        scheduleAt: result.scheduleAt?.toISOString(),
        status: result.status,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('[AGENDAR_COLETA_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Erro ao agendar coleta';
    return NextResponse.json({ message }, { status: 500 });
  }
}
