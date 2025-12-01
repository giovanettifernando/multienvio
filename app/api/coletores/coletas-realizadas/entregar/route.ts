
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';

interface DeliverToCarrierBody {
  pickupIds: string[];
  carrierRecipient: string;
  carrierUnit: string;
}

/**
 * POST /api/coletores/coletas-realizadas/entregar
 * Registra a entrega de múltiplas coletas na transportadora
 */
export async function POST(request: NextRequest) {
  try {
    // Validar autenticação
    const session = await getAutonomousCollectorSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Validar dados do body
    const body: DeliverToCarrierBody = await request.json();
    const { pickupIds, carrierRecipient, carrierUnit } = body;

    if (!pickupIds || pickupIds.length === 0) {
      return NextResponse.json(
        { message: 'Nenhuma coleta selecionada' },
        { status: 400 }
      );
    }

    if (!carrierRecipient || !carrierUnit) {
      return NextResponse.json(
        { message: 'Nome de quem recebeu e unidade da transportadora são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar pickups e validar
    const pickups = await prisma.pickupRequest.findMany({
      where: {
        id: { in: pickupIds },
      },
      include: {
        shipment: {
          select: {
            id: true,
            platformTrackingCode: true,
          },
        },
      },
    });

    // Validar que todos os pickups foram encontrados
    if (pickups.length !== pickupIds.length) {
      return NextResponse.json(
        { message: 'Algumas coletas não foram encontradas' },
        { status: 404 }
      );
    }

    // Validar que todas as coletas pertencem ao coletor logado
    const invalidCollector = pickups.find(p => p.collectorId !== session.coletorId);
    if (invalidCollector) {
      return NextResponse.json(
        { message: 'Você não tem permissão para entregar todas as coletas selecionadas' },
        { status: 403 }
      );
    }

    // Validar que todas as coletas estão com status COLLECTED
    const invalidStatus = pickups.find(p => p.status !== 'COLLECTED');
    if (invalidStatus) {
      return NextResponse.json(
        { message: `Coleta ${invalidStatus.shipment.platformTrackingCode} não está pronta para entrega (status: ${invalidStatus.status})` },
        { status: 400 }
      );
    }

    const now = new Date();

    // Atualizar todas as coletas em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar todos os PickupRequests para COMPLETED
      const updatedPickups = await Promise.all(
        pickupIds.map((id) =>
          tx.pickupRequest.update({
            where: { id },
            data: {
              status: 'COMPLETED',
              deliveredToCarrierAt: now,
              carrierRecipient: carrierRecipient.trim(),
              carrierUnit: carrierUnit.trim(),
              updatedAt: now,
            },
            select: {
              id: true,
              shipmentId: true,
              shipment: {
                select: {
                  platformTrackingCode: true,
                },
              },
            },
          })
        )
      );

      // 2. Atualizar status dos Shipments para IN_TRANSIT_TO_CARRIER_HUB
      await Promise.all(
        updatedPickups.map((pickup) =>
          tx.shipment.update({
            where: { id: pickup.shipmentId },
            data: {
              status: ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
            },
          })
        )
      );

      return updatedPickups;
    });

    console.log('[ENTREGAR_NA_TRANSPORTADORA] Coletas entregues:', {
      collectorId: session.coletorId,
      count: result.length,
      pickupIds,
      carrierRecipient,
      carrierUnit,
      deliveredAt: now.toISOString(),
    });

    return NextResponse.json({
      message: `${result.length} coleta(s) entregue(s) na transportadora com sucesso`,
      delivered: result.map(p => ({
        id: p.id,
        trackingCode: p.shipment.platformTrackingCode,
      })),
    }, { status: 200 });
  } catch (error) {
    console.error('[ENTREGAR_NA_TRANSPORTADORA_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Erro ao registrar entrega na transportadora';
    return NextResponse.json({ message }, { status: 500 });
  }
}
