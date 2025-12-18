import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { z } from 'zod';

interface PickupRequestCollector {
  id: string;
  name: string;
}

interface PickupRequestData {
  id: string;
  companyId: string | null;
  userId: string;
  shipmentId: string;
  collectorId: string | null;
  collector: PickupRequestCollector | null;
  status: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  scheduleAt: Date | null;
  collectedAt: Date | null;
  collectedBy: string | null;
  scannedCode: string | null;
  deliveredToCarrierAt: Date | null;
  carrierRecipient: string | null;
  carrierUnit: string | null;
  attemptCount: number;
  attemptNotes: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PickupRequestResponse {
  message: string;
  pickupRequest: PickupRequestData;
}

interface DeletePickupRequestResponse {
  message: string;
}

const PickupRequestSchema = z.object({
  collectorId: z.string().uuid().optional().nullable(),
  status: z.string().optional(),
  scheduleAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Create or update pickup request for a shipment
export const POST = withApiHandler<PickupRequestResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id: shipmentId } = await params;
  const body = await req.json();

  const parsed = PickupRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { collectorId, status, scheduleAt, notes } = parsed.data;

  // Check if shipment exists
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      senderId: true,
      originCep: true,
      destinationAddress: true,
      destinationCity: true,
      destinationState: true,
      pickupRequest: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!shipment) {
    throw new ApiError({ code: 'not_found', message: 'Envio não encontrado', status: 404 });
  }

  // If pickup request already exists, update it
  if (shipment.pickupRequest) {
    const updateData: Record<string, unknown> = {};

    if (collectorId !== undefined) updateData.collectorId = collectorId;
    if (status !== undefined) updateData.status = status;
    if (scheduleAt !== undefined) updateData.scheduleAt = scheduleAt ? new Date(scheduleAt) : null;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.pickupRequest.update({
      where: { id: shipment.pickupRequest.id },
      data: updateData,
      include: {
        collector: {
          select: {
            id: true,
            pfNome: true,
          },
        },
      },
    });

    // Transform collector name
    const response = {
      ...updated,
      collector: updated.collector ? {
        id: updated.collector.id,
        name: updated.collector.pfNome,
      } : null,
    };

    return {
      data: {
        message: 'Coleta atualizada com sucesso',
        pickupRequest: response,
      },
    };
  }

  // Create new pickup request
  const newPickupRequest = await prisma.pickupRequest.create({
    data: {
      userId: shipment.senderId,
      shipmentId: shipment.id,
      collectorId: collectorId || null,
      status: status || 'PENDING',
      scheduleAt: scheduleAt ? new Date(scheduleAt) : null,
      notes: notes || null,
      originCep: shipment.originCep,
      originAddress: shipment.destinationAddress || null,
      originCity: shipment.destinationCity,
      originUf: shipment.destinationState,
    },
    include: {
      collector: {
        select: {
          id: true,
          pfNome: true,
        },
      },
    },
  });

  // Transform collector name
  const response = {
    ...newPickupRequest,
    collector: newPickupRequest.collector ? {
      id: newPickupRequest.collector.id,
      name: newPickupRequest.collector.pfNome,
    } : null,
  };

  return {
    data: {
      message: 'Coleta criada com sucesso',
      pickupRequest: response,
    },
  };
});

// Delete pickup request
export const DELETE = withApiHandler<DeletePickupRequestResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id: shipmentId } = await params;

  // Find pickup request by shipment ID
  const pickupRequest = await prisma.pickupRequest.findUnique({
    where: { shipmentId },
  });

  if (!pickupRequest) {
    throw new ApiError({ code: 'not_found', message: 'Coleta não encontrada', status: 404 });
  }

  await prisma.pickupRequest.delete({
    where: { id: pickupRequest.id },
  });

  return { data: { message: 'Coleta removida com sucesso' } };
});
