import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { validateHmacSignature } from '@/platform/api/webhook-auth';
import { prisma } from "@/platform/db/db";
import { z } from "zod";
import type { TrackingEventType } from '@/shared/types/tracking';
import { ShipmentStatus, FINAL_STATUSES } from '@/modules/shipments/application/shipment-status';
import { isValidTransition } from '@/modules/shipments/application/status-migration';
import { auditStatusChange } from '@/modules/shipments/application/shipment-audit';

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
 * Mapeia tipos de evento para status de shipment
 */
const eventTypeToStatus: Partial<Record<TrackingEventType, ShipmentStatus>> = {
  DELIVERED: ShipmentStatus.DELIVERED,
  OUT_FOR_DELIVERY: ShipmentStatus.OUT_FOR_DELIVERY,
  IN_TRANSIT: ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
  ISSUE: ShipmentStatus.DELIVERY_PROBLEM,
};

/**
 * POST /api/webhooks/tracking
 * Recebe eventos de rastreamento de transportadoras
 * Protegido por autenticação HMAC
 */
export const POST = withApiHandler(async (context) => {
  const { req, logger } = context;

  // SECURITY: Validar assinatura HMAC
  const webhookSecret = process.env.TRACKING_WEBHOOK_SECRET;
  const signature = req.headers.get('x-webhook-signature');

  // Ler body como texto para validação de assinatura
  const bodyText = await req.text();

  // Em produção, a assinatura é obrigatória
  if (webhookSecret && process.env.NODE_ENV === 'production') {
    if (!validateHmacSignature(signature, bodyText, webhookSecret)) {
      logger.warn('tracking_webhook_auth_failed', { hasSignature: !!signature });
      throw new ApiError({
        code: 'unauthorized',
        message: 'Assinatura de webhook inválida',
        status: 401,
      });
    }
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(bodyText);
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

  // Verificar se o shipment existe e buscar status atual
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, status: true },
  });

  if (!shipment) {
    throw ApiError.notFound("Shipment não encontrado");
  }

  const currentStatus = shipment.status as ShipmentStatus;

  // SECURITY: Rejeitar eventos para shipments em status final
  if ((FINAL_STATUSES as readonly ShipmentStatus[]).includes(currentStatus)) {
    logger.warn('tracking_webhook_final_status', { shipmentId, status: currentStatus });
    throw ApiError.badRequest(`Shipment em status final (${currentStatus}) não pode receber eventos`);
  }

  // Mapear código da transportadora para tipo interno
  const eventType = carrierCodeMap[carrierCode] ?? carrierCodeMap[carrierCode.toUpperCase()] ?? "IN_TRANSIT";

  // Criar evento de rastreamento (sempre cria o evento)
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

  // Atualizar status do shipment se possível
  const newStatus = eventTypeToStatus[eventType];

  if (newStatus && newStatus !== currentStatus) {
    // SECURITY: Validar transição usando a matriz
    if (isValidTransition(currentStatus, newStatus)) {
      const updateData: Record<string, unknown> = { status: newStatus };

      // Adicionar deliveredAt se entregue
      if (newStatus === ShipmentStatus.DELIVERED) {
        updateData.deliveredAt = occurredAt ? new Date(occurredAt) : new Date();
      }

      await prisma.shipment.update({
        where: { id: shipmentId },
        data: updateData,
      });

      // SECURITY: Registrar auditoria
      await auditStatusChange({
        shipmentId,
        fromStatus: currentStatus,
        toStatus: newStatus,
        source: 'webhook',
        reason: description,
        metadata: {
          carrierCode,
          eventType,
          city,
          uf,
          occurredAt,
        },
      });

      logger.info('tracking_status_updated', { shipmentId, from: currentStatus, to: newStatus });
    } else {
      // Transição inválida - apenas loga, não atualiza status
      logger.warn('tracking_invalid_transition', {
        shipmentId,
        from: currentStatus,
        to: newStatus,
        eventType,
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
