import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from "@/platform/db/db";
import { z } from "zod";
import type { TrackingEventType } from '@/shared/types/tracking';

/**
 * Schema de validação para webhook de tracking
 */
const TrackingWebhookSchema = z.object({
  shipmentId: z.string().uuid("shipmentId deve ser um UUID válido"),
  code: z.string().min(1, "code é obrigatório").max(50),
  description: z.string().min(1, "description é obrigatório").max(500),
  city: z.string().max(100).optional(),
  uf: z.string().length(2).toUpperCase().optional(),
  occurredAt: z.string().datetime().optional(),
});

/**
 * Mapeia códigos de transportadoras para tipos de evento internos
 */
const carrierCodeMap: Record<string, TrackingEventType> = {
  // Códigos padrão
  CREATED: "CREATED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELAYED: "DELAYED",
  ISSUE: "ISSUE",
  // Códigos Correios
  "BDE": "OUT_FOR_DELIVERY",
  "BDI": "IN_TRANSIT",
  "BDR": "DELIVERED",
  "OEC": "OUT_FOR_DELIVERY",
  "DO": "IN_TRANSIT",
  // Fallbacks
  "posted": "PICKED_UP",
  "collected": "PICKED_UP",
  "transit": "IN_TRANSIT",
  "delivery": "OUT_FOR_DELIVERY",
  "delivered": "DELIVERED",
  "delayed": "DELAYED",
  "issue": "ISSUE",
  "exception": "ISSUE",
};

/**
 * POST /api/webhooks/tracking
 * Recebe eventos de rastreamento de transportadoras
 * Este endpoint deve ser protegido por autenticação de webhook em produção
 */
export const POST = withApiHandler(async (context) => {
  let rawPayload: unknown;
  try {
    rawPayload = await context.req.json();
  } catch {
    throw ApiError.badRequest("JSON inválido no corpo da requisição");
  }

  // Validar payload com Zod
  const parseResult = TrackingWebhookSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw ApiError.badRequest(`Dados inválidos: ${errors}`);
  }

  const { shipmentId, code: carrierCode, description, city, uf, occurredAt } = parseResult.data;

  // Verificar se o shipment existe
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true },
  });

  if (!shipment) {
    throw ApiError.notFound("Shipment não encontrado");
  }

  // Mapear código da transportadora para tipo interno
  const eventType = carrierCodeMap[carrierCode] ?? carrierCodeMap[carrierCode.toUpperCase()] ?? "IN_TRANSIT";

  // Criar evento de rastreamento
  const trackingEvent = await prisma.trackingEvent.create({
    data: {
      shipmentId,
      type: eventType,
      description,
      city: city || null,
      uf: uf || null,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    },
  });

  // Atualizar status do shipment se necessário
  if (eventType === "DELIVERED") {
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: "DELIVERED",
        deliveredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
    });
  } else if (eventType === "ISSUE" || eventType === "DELAYED") {
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: eventType },
    });
  } else if (eventType === "IN_TRANSIT" || eventType === "OUT_FOR_DELIVERY") {
    // Atualizar status apenas se não estiver em estado final
    const currentShipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { status: true },
    });
    if (currentShipment && !["DELIVERED", "CANCELED", "RETURNED"].includes(currentShipment.status)) {
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { status: eventType },
      });
    }
  }

  return {
    data: {
      success: true,
      eventId: trackingEvent.id,
      eventType,
    },
  };
});
