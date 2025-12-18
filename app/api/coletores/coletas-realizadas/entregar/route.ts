import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { getAutonomousCollectorSession } from '@/modules/auth/application/autonomous-collector-session';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';

const DeliverToCarrierSchema = z.object({
  pickupIds: z.array(z.string().min(1)).min(1, 'Nenhuma coleta selecionada'),
  carrierRecipient: z.string().min(1, 'Nome de quem recebeu é obrigatório'),
  carrierUnit: z.string().min(1, 'Unidade da transportadora é obrigatória'),
});

type EntregarNaTransportadoraResponse = {
  message: string;
  delivered: Array<{
    id: string;
    trackingCode: string | null;
  }>;
};

/**
 * POST /api/coletores/coletas-realizadas/entregar
 * Registra a entrega de múltiplas coletas na transportadora
 */
export const POST = withApiHandler<EntregarNaTransportadoraResponse>(async (context) => {
  const { req, logger } = context;

  // Validar autenticação
  const session = await getAutonomousCollectorSession();
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  // Validar dados do body
  const body = await req.json();
  const parsed = DeliverToCarrierSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { pickupIds, carrierRecipient, carrierUnit } = parsed.data;

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
    throw new ApiError({
      code: 'not_found',
      message: 'Algumas coletas não foram encontradas',
      status: 404,
    });
  }

  // Validar que todas as coletas pertencem ao coletor logado
  const invalidCollector = pickups.find(p => p.collectorId !== session.coletorId);
  if (invalidCollector) {
    throw new ApiError({
      code: 'forbidden',
      message: 'Você não tem permissão para entregar todas as coletas selecionadas',
      status: 403,
    });
  }

  // Validar que todas as coletas estão com status COLLECTED
  const invalidStatus = pickups.find(p => p.status !== 'COLLECTED');
  if (invalidStatus) {
    throw new ApiError({
      code: 'invalid_status',
      message: `Coleta ${invalidStatus.shipment.platformTrackingCode} não está pronta para entrega (status: ${invalidStatus.status})`,
      status: 400,
    });
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

  logger.info('entregar_na_transportadora_success', {
    collectorId: session.coletorId,
    count: result.length,
    pickupIds,
    carrierRecipient,
    carrierUnit,
    deliveredAt: now.toISOString(),
  });

  return {
    data: {
      message: `${result.length} coleta(s) entregue(s) na transportadora com sucesso`,
      delivered: result.map(p => ({
        id: p.id,
        trackingCode: p.shipment.platformTrackingCode,
      })),
    },
  };
});
