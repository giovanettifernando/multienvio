/**
 * API Route para registrar entrada de envio no hub
 * POST /api/pontos-coleta/receptions/[id]/register-entry
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';

const RegisterEntrySchema = z.object({
  trackingCode: z.string().min(1, 'Código de rastreio é obrigatório'),
});

type RegisterEntryResponse = {
  message: string;
  shipment: {
    id: string;
    trackingCode: string | null;
    receivedAt: string | null;
    status: string;
  };
};

/**
 * POST /api/pontos-coleta/receptions/[id]/register-entry
 * Registra entrada do envio no hub
 */
export const POST = withApiHandler<RegisterEntryResponse, { id: string }>(async ({ req, params, logger }) => {
  // Verificar autenticação do ponto de coleta
  const session = await getCollectorSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  const body = await req.json();
  const validatedData = RegisterEntrySchema.parse(body);

  // Buscar o envio
  const shipment = await prisma.shipment.findUnique({
    where: { id: params.id },
  });

  if (!shipment) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Envio não encontrado', status: 404 });
  }

  // Validar se já foi recebido
  if (shipment.receivedAt) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Este envio já foi registrado como recebido',
      status: 400,
    });
  }

  // Validar código de rastreio
  if (shipment.platformTrackingCode !== validatedData.trackingCode) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Código de rastreio não corresponde ao envio selecionado',
      status: 400,
    });
  }

  // Registrar recebimento
  const updatedShipment = await prisma.shipment.update({
    where: { id: params.id },
    data: {
      receivedAt: new Date(),
      receivedBy: session.pointId,
      status: 'recebido', // Atualizar status para "recebido"
    },
  });

  // Criar evento de rastreamento
  await prisma.trackingEvent.create({
    data: {
      shipmentId: params.id,
      type: 'recebido',
      description: 'Envio recebido no hub de distribuição',
      city: 'Hub de Distribuição',
      occurredAt: new Date(),
    },
  });

  logger.info('shipment_entry_registered', {
    shipmentId: params.id,
    pointId: session.pointId,
    trackingCode: validatedData.trackingCode,
  });

  return {
    data: {
      message: 'Entrada registrada com sucesso',
      shipment: {
        id: updatedShipment.id,
        trackingCode: updatedShipment.platformTrackingCode,
        receivedAt: updatedShipment.receivedAt?.toISOString() ?? null,
        status: updatedShipment.status,
      },
    },
  };
});
