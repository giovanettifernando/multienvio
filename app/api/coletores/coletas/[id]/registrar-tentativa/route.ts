import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import { ShipmentStatus } from '@/lib/shipments/shipment-status';
import { chargeAdditionalPickupFee } from '@/lib/services/additionalPickupFee';

const RegisterAttemptSchema = z.object({
  notes: z.string().optional(),
});

type RegistrarTentativaResponse = {
  message: string;
  pickup: {
    id: string;
    status: string;
    attemptCount: number;
    attemptNotes: unknown;
  };
  additionalFeeCharged: {
    success: boolean;
    method: string;
    amountCents: number;
    message: string;
  } | null;
};

/**
 * POST /api/coletores/coletas/[id]/registrar-tentativa
 * Registra uma tentativa de coleta sem sucesso
 */
export const POST = withApiHandler<RegistrarTentativaResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  // Validar autenticação
  const session = await getAutonomousCollectorSession();
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { id } = params;

  // Validar dados do body
  const body = await req.json();
  const parsed = RegisterAttemptSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { notes } = parsed.data;

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

  logger.info('registrar_tentativa_success', {
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

      logger.info('registrar_tentativa_fee_charged', {
        method: chargeResult.method,
        amountCents: chargeResult.amountCents,
        newBalance: chargeResult.newBalanceCents,
      });
    } catch (chargeError) {
      // Não bloquear o registro da tentativa se a cobrança falhar
      logger.error('registrar_tentativa_fee_error', { err: chargeError });
    }
  }

  const message = shouldMarkAsFailed
    ? `Tentativa ${result.attemptCount} registrada. Coleta marcada como falhou após ${MAX_ATTEMPTS} tentativas.`
    : 'Tentativa de coleta registrada com sucesso';

  return {
    data: {
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
    },
  };
});
