export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';

interface RegisterCollectionBody {
  scannedCode: string;
  collectedBy: string;
}

/**
 * POST /api/coletores/coletas/[id]/registrar
 * Registra a realização de uma coleta pelo coletor
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
    const body: RegisterCollectionBody = await request.json();
    const { scannedCode, collectedBy } = body;

    if (!scannedCode || !collectedBy) {
      return NextResponse.json(
        { message: 'Código de rastreio e nome de quem entregou são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar pickup request
    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id },
      include: {
        shipment: {
          select: {
            id: true,
            platformTrackingCode: true,
          },
        },
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

    // Validar código de rastreio (opcional - pode ser diferente se o usuário digitou manualmente)
    // Aqui apenas registramos o que foi informado
    const now = new Date();

    // Atualizar pickup request e shipment status em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar PickupRequest como COMPLETED
      const updatedPickupRequest = await tx.pickupRequest.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          collectedAt: now,
          collectedBy: collectedBy.trim(),
          scannedCode: scannedCode.trim(),
          updatedAt: now,
        },
        select: {
          id: true,
          status: true,
          collectedAt: true,
          collectedBy: true,
          scannedCode: true,
          shipmentId: true,
        },
      });

      // 2. Atualizar Shipment.status para COLLECTED_FROM_SENDER
      await tx.shipment.update({
        where: { id: updatedPickupRequest.shipmentId },
        data: {
          status: ShipmentStatus.COLLECTED_FROM_SENDER,
        },
      });

      return updatedPickupRequest;
    });

    console.log('[REGISTRAR_COLETA] Coleta registrada:', {
      pickupId: id,
      collectorId: session.coletorId,
      collectedBy,
      scannedCode,
      collectedAt: now.toISOString(),
      shipmentStatus: ShipmentStatus.COLLECTED_FROM_SENDER,
    });

    return NextResponse.json({
      message: 'Coleta registrada com sucesso',
      pickup: {
        id: result.id,
        status: result.status,
        collectedAt: result.collectedAt?.toISOString(),
        collectedBy: result.collectedBy,
        scannedCode: result.scannedCode,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('[REGISTRAR_COLETA_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Erro ao registrar coleta';
    return NextResponse.json({ message }, { status: 500 });
  }
}
