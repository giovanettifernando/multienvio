import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from "@/lib/db";
import type { TrackingEventType } from "@/types/tracking";

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
  let payload: Record<string, unknown>;
  try {
    payload = await context.req.json();
  } catch {
    throw ApiError.badRequest("JSON inválido no corpo da requisição");
  }

  const shipmentId = payload?.shipmentId as string;
  const carrierCode = payload?.code as string;
  const description = payload?.description as string;
  const city = payload?.city as string | undefined;
  const uf = payload?.uf as string | undefined;
  const occurredAt = payload?.occurredAt as string | undefined;

  if (!shipmentId || !carrierCode || !description) {
    throw ApiError.badRequest("shipmentId, code e description são obrigatórios");
  }

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
