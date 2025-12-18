import { PrismaClient } from '@prisma/client';
import { getPublicStatusMessage } from './status-messages';

/**
 * Criar evento de rastreamento para um shipment
 *
 * @param tx - Instância do Prisma (pode ser uma transação ou cliente direto)
 * @param shipmentId - ID do shipment
 * @param type - Tipo do evento (ex: CREATED, POSTED, IN_TRANSIT)
 * @param description - Descrição customizada (opcional, usa mensagem padrão se não fornecida)
 * @param city - Cidade do evento (opcional)
 * @param uf - UF do evento (opcional)
 * @param occurredAt - Data/hora do evento (opcional, usa now() se não fornecida)
 */
export async function createTrackingEvent(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  params: {
    shipmentId: string;
    type: string;
    description?: string;
    city?: string | null;
    uf?: string | null;
    occurredAt?: Date;
  }
) {
  const { shipmentId, type, description, city, uf, occurredAt } = params;

  // Usar descrição fornecida ou buscar mensagem padrão
  const eventDescription = description || getPublicStatusMessage(type);

  return await tx.trackingEvent.create({
    data: {
      shipmentId,
      type,
      description: eventDescription,
      city: city || null,
      uf: uf || null,
      occurredAt: occurredAt || new Date(),
    },
  });
}

/**
 * Criar evento inicial baseado no status do shipment
 * Usado quando um shipment é criado sem eventos
 */
export async function createInitialTrackingEvent(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  shipmentId: string,
  status: string,
  createdAt?: Date
) {
  // Mapear status para tipo de evento
  const eventType = status.toUpperCase();

  return await createTrackingEvent(tx, {
    shipmentId,
    type: eventType,
    description: getPublicStatusMessage(status),
    occurredAt: createdAt || new Date(),
  });
}
