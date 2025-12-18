import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { getAutonomousCollectorSession } from '@/modules/auth/application/autonomous-collector-session';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';

const RegisterCollectionSchema = z.object({
  scannedCode: z.string().min(1, 'Código de rastreio é obrigatório'),
  collectedBy: z.string().min(1, 'Nome de quem entregou é obrigatório'),
});

type RegistrarColetaResponse = {
  message: string;
  pickup: {
    id: string;
    status: string;
    collectedAt: string | null;
    collectedBy: string | null;
    scannedCode: string | null;
  };
};

/**
 * POST /api/coletores/coletas/[id]/registrar
 * Registra a realização de uma coleta pelo coletor
 */
export const POST = withApiHandler<RegistrarColetaResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  // Validar autenticação
  const session = await getAutonomousCollectorSession();
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { id } = params;

  // Validar dados do body
  const body = await req.json();
  const parsed = RegisterCollectionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { scannedCode, collectedBy } = parsed.data;

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
    throw new ApiError({ code: 'not_found', message: 'Coleta não encontrada', status: 404 });
  }

  // Validar que a coleta pertence ao coletor logado
  if (pickupRequest.collectorId !== session.coletorId) {
    throw new ApiError({
      code: 'forbidden',
      message: 'Esta coleta não está atribuída a você',
      status: 403,
    });
  }

  // Validar que a coleta está pendente ou agendada
  if (!['PENDING', 'SCHEDULED'].includes(pickupRequest.status)) {
    throw new ApiError({
      code: 'invalid_status',
      message: `Coleta já foi processada (status: ${pickupRequest.status})`,
      status: 400,
    });
  }

  const now = new Date();

  // Atualizar pickup request e shipment status em uma transação
  const result = await prisma.$transaction(async (tx) => {
    // 1. Atualizar PickupRequest como COLLECTED (aguardando entrega na transportadora)
    const updatedPickupRequest = await tx.pickupRequest.update({
      where: { id },
      data: {
        status: 'COLLECTED',
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

  logger.info('registrar_coleta_success', {
    pickupId: id,
    collectorId: session.coletorId,
    collectedBy,
    scannedCode,
    collectedAt: now.toISOString(),
    shipmentStatus: ShipmentStatus.COLLECTED_FROM_SENDER,
  });

  return {
    data: {
      message: 'Coleta registrada com sucesso',
      pickup: {
        id: result.id,
        status: result.status,
        collectedAt: result.collectedAt?.toISOString() ?? null,
        collectedBy: result.collectedBy,
        scannedCode: result.scannedCode,
      },
    },
  };
});
