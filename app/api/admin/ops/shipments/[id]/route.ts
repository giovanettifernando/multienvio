import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { z } from 'zod';

interface ShipmentDetailCollector {
  id: string;
  name: string;
}

interface ShipmentDetailPickupRequest {
  id: string;
  companyId: string | null;
  userId: string;
  shipmentId: string;
  collectorId: string | null;
  collector: ShipmentDetailCollector | null;
  status: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  scheduleAt: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  scannedCode: string | null;
  deliveredToCarrierAt: string | null;
  carrierRecipient: string | null;
  carrierUnit: string | null;
  attemptCount: number;
  attemptNotes: unknown;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ShipmentDetailLabel {
  id: string;
  shipmentId: string;
  carrier: string;
  service: string;
  status: string;
  priceCents: number;
  currency: string;
  trackingCode: string | null;
  recipientName: string | null;
  fileUrl: string | null;
  fileBase64: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  isPrinted: boolean;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ShipmentDetailPackage {
  id: string;
  shipmentId: string;
  packageNumber: number;
  width: number;
  height: number;
  length: number;
  weight: number;
  carrierTrackingCode: string | null;
  carrierPrePostageId: string | null;
  carrierQuotePrice: number | null;
  hasDivergence: boolean;
  divergenceType: string | null;
  divergenceNotes: string | null;
  divergenceWidth: number | null;
  divergenceHeight: number | null;
  divergenceLength: number | null;
  divergenceWeight: number | null;
  divergencePhotoUrl: string | null;
  divergenceRegisteredAt: string | null;
  divergenceRegisteredBy: string | null;
  checkedAt: string | null;
  checkedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ShipmentDetailTrackingEvent {
  id: string;
  shipmentId: string;
  type: string;
  description: string;
  city: string | null;
  uf: string | null;
  occurredAt: string;
  createdAt: string;
}

interface ShipmentDetailSender {
  id: string;
  name: string | null;
  email: string;
}

interface ShipmentDetailRecipient {
  id: string;
  name: string;
  email: string | null;
}

interface ShipmentDetailResponse {
  id: string;
  platformTrackingCode: string;
  carrierTrackingCode: string | null;
  carrierMetadata: unknown;
  senderId: string;
  sender: ShipmentDetailSender;
  recipientId: string | null;
  recipient: ShipmentDetailRecipient | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientDocument: string | null;
  destinationAddress: string | null;
  destinationNeighborhood: string | null;
  destinationCity: string;
  destinationState: string;
  destinationCep: string;
  originCep: string;
  weight: number;
  declaredValue: number;
  status: string;
  carrier: string | null;
  service: string | null;
  estimatedDays: number | null;
  freightCost: number | null;
  pickupFee: number | null;
  pickupPointId: string | null;
  document: unknown;
  paymentMethod: string | null;
  publicTrackingId: string | null;
  postedAt: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  deliveredAt: string | null;
  platformShippingCommissionCents: number | null;
  platformPickupCommissionCents: number | null;
  pickupRequest: ShipmentDetailPickupRequest | null;
  label: ShipmentDetailLabel | null;
  packages: ShipmentDetailPackage[];
  trackingEvents: ShipmentDetailTrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

interface ShipmentUpdateResponse {
  message: string;
  shipment: {
    id: string;
    platformTrackingCode: string;
    carrierTrackingCode: string | null;
    carrierMetadata: unknown;
    senderId: string;
    recipientId: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    recipientEmail: string | null;
    recipientDocument: string | null;
    destinationAddress: string | null;
    destinationNeighborhood: string | null;
    destinationCity: string;
    destinationState: string;
    destinationCep: string;
    originCep: string;
    weight: number;
    declaredValue: number;
    status: string;
    carrier: string | null;
    service: string | null;
    estimatedDays: number | null;
    freightCost: number | null;
    pickupFee: number | null;
    pickupPointId: string | null;
    document: unknown;
    paymentMethod: string | null;
    publicTrackingId: string | null;
    postedAt: Date | null;
    receivedAt: Date | null;
    receivedBy: string | null;
    deliveredAt: Date | null;
    platformShippingCommissionCents: number | null;
    platformPickupCommissionCents: number | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export const GET = withApiHandler<ShipmentDetailResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id } = await params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recipient: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      pickupRequest: {
        include: {
          collector: {
            select: {
              id: true,
              pfNome: true,
            },
          },
        },
      },
      label: true,
      packages: {
        orderBy: {
          packageNumber: 'asc',
        },
      },
      trackingEvents: {
        orderBy: {
          occurredAt: 'desc',
        },
      },
    },
  });

  if (!shipment) {
    throw new ApiError({ code: 'not_found', message: 'Envio não encontrado', status: 404 });
  }

  // Transform dates to ISO strings
  const response = {
    ...shipment,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
    postedAt: shipment.postedAt?.toISOString() || null,
    receivedAt: shipment.receivedAt?.toISOString() || null,
    deliveredAt: shipment.deliveredAt?.toISOString() || null,
    pickupRequest: shipment.pickupRequest
      ? {
          ...shipment.pickupRequest,
          collector: shipment.pickupRequest.collector
            ? {
                id: shipment.pickupRequest.collector.id,
                name: shipment.pickupRequest.collector.pfNome,
              }
            : null,
          createdAt: shipment.pickupRequest.createdAt.toISOString(),
          updatedAt: shipment.pickupRequest.updatedAt.toISOString(),
          windowStart: shipment.pickupRequest.windowStart?.toISOString() || null,
          windowEnd: shipment.pickupRequest.windowEnd?.toISOString() || null,
          collectedAt: shipment.pickupRequest.collectedAt?.toISOString() || null,
          deliveredToCarrierAt: shipment.pickupRequest.deliveredToCarrierAt?.toISOString() || null,
          scheduleAt: shipment.pickupRequest.scheduleAt?.toISOString() || null,
        }
      : null,
    label: shipment.label
      ? {
          ...shipment.label,
          createdAt: shipment.label.createdAt.toISOString(),
          updatedAt: shipment.label.updatedAt.toISOString(),
          printedAt: shipment.label.printedAt?.toISOString() || null,
        }
      : null,
    packages: shipment.packages.map((pkg) => ({
      ...pkg,
      createdAt: pkg.createdAt.toISOString(),
      updatedAt: pkg.updatedAt.toISOString(),
      divergenceRegisteredAt: pkg.divergenceRegisteredAt?.toISOString() || null,
      checkedAt: pkg.checkedAt?.toISOString() || null,
    })),
    trackingEvents: shipment.trackingEvents.map((evt) => ({
      ...evt,
      occurredAt: evt.occurredAt.toISOString(),
      createdAt: evt.createdAt.toISOString(),
    })),
  };

  return { data: response };
});

const ShipmentUpdateSchema = z.object({
  status: z.string().optional(),
  carrier: z.string().optional(),
  service: z.string().optional(),
  carrierTrackingCode: z.string().optional(),
  weight: z.number().positive().optional(),
  declaredValue: z.number().min(0).optional(),
  freightCost: z.number().min(0).optional(),
  pickupFee: z.number().min(0).optional(),
  estimatedDays: z.number().int().positive().optional(),
  recipientName: z.string().min(1).optional(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientDocument: z.string().optional(),
  destinationAddress: z.string().min(1).optional(),
  destinationNeighborhood: z.string().optional(),
  destinationCity: z.string().min(1).optional(),
  destinationState: z.string().length(2).optional(),
  destinationCep: z.string().regex(/^\d{8}$/).optional(),
  pickupPointId: z.string().uuid().optional(),
});

export const PATCH = withApiHandler<ShipmentUpdateResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const parsed = ShipmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  // Extract allowed fields for update
  const updateData: Record<string, unknown> = {};
  const validatedData = parsed.data;

  // Status and carrier fields
  if (validatedData.status !== undefined) updateData.status = validatedData.status;
  if (validatedData.carrier !== undefined) updateData.carrier = validatedData.carrier;
  if (validatedData.service !== undefined) updateData.service = validatedData.service;
  if (validatedData.carrierTrackingCode !== undefined)
    updateData.carrierTrackingCode = validatedData.carrierTrackingCode;

  // Weight and values
  if (validatedData.weight !== undefined) updateData.weight = validatedData.weight;
  if (validatedData.declaredValue !== undefined) updateData.declaredValue = validatedData.declaredValue;
  if (validatedData.freightCost !== undefined) updateData.freightCost = validatedData.freightCost;
  if (validatedData.pickupFee !== undefined) updateData.pickupFee = validatedData.pickupFee;
  if (validatedData.estimatedDays !== undefined) updateData.estimatedDays = validatedData.estimatedDays;

  // Recipient fields
  if (validatedData.recipientName !== undefined) updateData.recipientName = validatedData.recipientName;
  if (validatedData.recipientPhone !== undefined) updateData.recipientPhone = validatedData.recipientPhone;
  if (validatedData.recipientEmail !== undefined) updateData.recipientEmail = validatedData.recipientEmail;
  if (validatedData.recipientDocument !== undefined)
    updateData.recipientDocument = validatedData.recipientDocument;

  // Destination address fields
  if (validatedData.destinationAddress !== undefined)
    updateData.destinationAddress = validatedData.destinationAddress;
  if (validatedData.destinationNeighborhood !== undefined)
    updateData.destinationNeighborhood = validatedData.destinationNeighborhood;
  if (validatedData.destinationCity !== undefined) updateData.destinationCity = validatedData.destinationCity;
  if (validatedData.destinationState !== undefined)
    updateData.destinationState = validatedData.destinationState;
  if (validatedData.destinationCep !== undefined) updateData.destinationCep = validatedData.destinationCep;

  // Pickup point
  if (validatedData.pickupPointId !== undefined) updateData.pickupPointId = validatedData.pickupPointId;

  const updatedShipment = await prisma.shipment.update({
    where: { id },
    data: updateData,
  });

  return {
    data: {
      message: 'Envio atualizado com sucesso',
      shipment: updatedShipment,
    },
  };
});
