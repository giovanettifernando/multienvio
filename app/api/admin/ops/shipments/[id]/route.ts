import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { z } from 'zod';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { isValidTransition } from '@/modules/shipments/application/status-migration';
import { auditStatusChange } from '@/modules/shipments/application/shipment-audit';



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
  document: unknown;
  paymentMethod: string | null;
  publicTrackingId: string | null;
  postedAt: string | null;
  deliveredAt: string | null;
  platformShippingCommissionCents: number | null;
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
    document: unknown;
    paymentMethod: string | null;
    publicTrackingId: string | null;
    postedAt: Date | null;
    deliveredAt: Date | null;
    platformShippingCommissionCents: number | null;
      createdAt: Date;
    updatedAt: Date;
  };
}

export const GET = withApiHandler<ShipmentDetailResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  await requireAdminSession(req, AdminPermission.OPERACOES);

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
    deliveredAt: shipment.deliveredAt?.toISOString() || null,
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
});

export const PATCH = withApiHandler<ShipmentUpdateResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await requireAdminSession(req, AdminPermission.OPERACOES);

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

  // Buscar shipment atual para validações
  const currentShipment = await prisma.shipment.findUnique({
    where: { id },
    select: { status: true, label: { select: { id: true } } },
  });

  if (!currentShipment) {
    throw new ApiError({ code: 'not_found', message: 'Envio não encontrado', status: 404 });
  }

  // Extract allowed fields for update
  const updateData: Record<string, unknown> = {};
  const validatedData = parsed.data;

  // SECURITY: Validar transição de status usando a matriz
  if (validatedData.status !== undefined) {
    const fromStatus = currentShipment.status as ShipmentStatus;
    const toStatus = validatedData.status as ShipmentStatus;

    if (!isValidTransition(fromStatus, toStatus)) {
      throw new ApiError({
        code: 'invalid_transition',
        message: `Transição de status não permitida: ${fromStatus} → ${toStatus}`,
        status: 400,
      });
    }
    updateData.status = validatedData.status;
  }
  if (validatedData.carrier !== undefined) updateData.carrier = validatedData.carrier;
  if (validatedData.service !== undefined) updateData.service = validatedData.service;
  if (validatedData.carrierTrackingCode !== undefined)
    updateData.carrierTrackingCode = validatedData.carrierTrackingCode;

  // Weight and values
  if (validatedData.weight !== undefined) updateData.weight = validatedData.weight;
  if (validatedData.declaredValue !== undefined) updateData.declaredValue = validatedData.declaredValue;
  if (validatedData.freightCost !== undefined) updateData.freightCost = validatedData.freightCost;
  if (validatedData.estimatedDays !== undefined) updateData.estimatedDays = validatedData.estimatedDays;

  // SECURITY: Verifica se há alteração de destinatário/endereço após etiqueta gerada
  const hasAddressOrRecipientChanges =
    validatedData.recipientName !== undefined ||
    validatedData.recipientPhone !== undefined ||
    validatedData.recipientEmail !== undefined ||
    validatedData.recipientDocument !== undefined ||
    validatedData.destinationAddress !== undefined ||
    validatedData.destinationNeighborhood !== undefined ||
    validatedData.destinationCity !== undefined ||
    validatedData.destinationState !== undefined ||
    validatedData.destinationCep !== undefined;

  if (hasAddressOrRecipientChanges && currentShipment.label) {
    throw new ApiError({
      code: 'cannot_edit',
      message: 'Não é possível alterar destinatário ou endereço após a etiqueta ser gerada',
      status: 400,
    });
  }

  // Recipient fields (somente se etiqueta não foi gerada)
  if (validatedData.recipientName !== undefined) updateData.recipientName = validatedData.recipientName;
  if (validatedData.recipientPhone !== undefined) updateData.recipientPhone = validatedData.recipientPhone;
  if (validatedData.recipientEmail !== undefined) updateData.recipientEmail = validatedData.recipientEmail;
  if (validatedData.recipientDocument !== undefined)
    updateData.recipientDocument = validatedData.recipientDocument;

  // Destination address fields (somente se etiqueta não foi gerada)
  if (validatedData.destinationAddress !== undefined)
    updateData.destinationAddress = validatedData.destinationAddress;
  if (validatedData.destinationNeighborhood !== undefined)
    updateData.destinationNeighborhood = validatedData.destinationNeighborhood;
  if (validatedData.destinationCity !== undefined) updateData.destinationCity = validatedData.destinationCity;
  if (validatedData.destinationState !== undefined)
    updateData.destinationState = validatedData.destinationState;
  if (validatedData.destinationCep !== undefined) updateData.destinationCep = validatedData.destinationCep;

  const updatedShipment = await prisma.shipment.update({
    where: { id },
    data: updateData,
  });

  // SECURITY: Registrar auditoria para mudanças de status
  if (validatedData.status !== undefined) {
    const fromStatus = currentShipment.status as ShipmentStatus;
    const toStatus = validatedData.status as ShipmentStatus;

    await auditStatusChange({
      shipmentId: id,
      fromStatus,
      toStatus,
      source: 'admin',
      actorId: session.staffId,
      actorEmail: session.email,
      metadata: {
        updatedFields: Object.keys(updateData),
      },
    });
  }

  return {
    data: {
      message: 'Envio atualizado com sucesso',
      shipment: updatedShipment,
    },
  };
});
