/**
 * Serviço de auditoria para mudanças de status de envio
 *
 * SECURITY: Registra todas as mudanças de status com:
 * - Quem fez a mudança (admin, webhook, sistema)
 * - Quando ocorreu
 * - Status anterior e novo
 * - Contexto adicional (IP, razão, etc.)
 */

import { prisma } from '@/platform/db/db';
import { logger } from '@/platform/logging/logger';
import { ShipmentStatus } from './shipment-status';

export type AuditSource =
  | 'admin' // Mudança feita por admin
  | 'webhook' // Mudança feita por webhook externo
  | 'system' // Mudança automática do sistema
  | 'user' // Mudança feita pelo usuário
  | 'cron'; // Mudança feita por job agendado

export interface ShipmentAuditEntry {
  shipmentId: string;
  fromStatus: ShipmentStatus;
  toStatus: ShipmentStatus;
  source: AuditSource;
  actorId?: string; // userId ou staffUserId
  actorEmail?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  requestId?: string;
}

/**
 * Registra uma mudança de status no log de auditoria
 *
 * Usa duas abordagens:
 * 1. Structured logging para análise em tempo real
 * 2. StaffAuditLog para ações de admin (persistência no banco)
 */
export async function auditStatusChange(entry: ShipmentAuditEntry): Promise<void> {
  const {
    shipmentId,
    fromStatus,
    toStatus,
    source,
    actorId,
    actorEmail,
    reason,
    metadata,
    ipAddress,
    requestId,
  } = entry;

  // 1. Structured logging (sempre)
  logger.info(
    {
      event: 'shipment_status_change',
      shipmentId,
      fromStatus,
      toStatus,
      source,
      actorId,
      actorEmail,
      reason,
      ipAddress,
      requestId,
      metadata,
      timestamp: new Date().toISOString(),
    },
    `Shipment ${shipmentId}: ${fromStatus} -> ${toStatus} (${source})`
  );

  // 2. Persistir no banco para ações de admin
  if (source === 'admin' && actorId) {
    try {
      await prisma.staffAuditLog.create({
        data: {
          actorId,
          action: 'UPDATE_STATUS',
          entity: 'Shipment',
          entityId: shipmentId,
          data: {
            fromStatus,
            toStatus,
            reason,
            ipAddress,
            requestId,
            ...metadata,
          },
        },
      });
    } catch (error) {
      // Não falhar a operação principal se o audit falhar
      logger.error(
        {
          event: 'audit_log_failed',
          shipmentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to persist audit log'
      );
    }
  }

  // 3. Criar evento de tracking para mudanças significativas
  const significantTransitions: ShipmentStatus[] = [
    ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
    ShipmentStatus.DELIVERED,
    ShipmentStatus.RETURNED_TO_SENDER,
  ];

  if (significantTransitions.includes(toStatus)) {
    try {
      await prisma.trackingEvent.create({
        data: {
          shipmentId,
          type: `STATUS_${toStatus}`,
          description: getStatusChangeDescription(fromStatus, toStatus, source, reason),
          occurredAt: new Date(),
        },
      });
    } catch (error) {
      logger.error(
        {
          event: 'tracking_event_failed',
          shipmentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to create tracking event for status change'
      );
    }
  }
}

/**
 * Gera descrição legível para a mudança de status
 */
function getStatusChangeDescription(
  fromStatus: ShipmentStatus,
  toStatus: ShipmentStatus,
  source: AuditSource,
  reason?: string
): string {
  const sourceLabels: Record<AuditSource, string> = {
    admin: 'pela administração',
    webhook: 'pela transportadora',
    system: 'automaticamente',
    user: 'pelo usuário',
    cron: 'por processo automático',
  };

  let description = `Status alterado de ${fromStatus} para ${toStatus} ${sourceLabels[source]}`;

  if (reason) {
    description += `. Motivo: ${reason}`;
  }

  return description;
}

/**
 * Busca histórico de auditoria de um envio
 */
export async function getShipmentAuditHistory(
  shipmentId: string
): Promise<Array<{ action: string; data: unknown; createdAt: Date; actorId: string | null }>> {
  const logs = await prisma.staffAuditLog.findMany({
    where: {
      entity: 'Shipment',
      entityId: shipmentId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      action: true,
      data: true,
      createdAt: true,
      actorId: true,
    },
  });

  return logs;
}
