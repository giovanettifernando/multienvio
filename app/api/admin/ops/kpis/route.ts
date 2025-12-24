/**
 * API de KPIs de Operações
 *
 * CACHE: Usa SWR (Stale-While-Revalidate) para UI responsiva:
 * - Retorna dados cacheados imediatamente
 * - Revalida em background se stale (>30s)
 * - Força busca síncrona se expirado (>3min)
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import type { OpsKpis } from '@/modules/admin/application/ops/types';
import prisma from '@/platform/db/db';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import { kpisCache } from '@/platform/cache/cache';

// Grupos de status por KPI
const STATUS_GROUPS = {
  // Backlog: aguardando coleta/postagem
  backlog: [
    ShipmentStatus.PICKUP_REQUESTED,
    ShipmentStatus.PICKUP_SCHEDULED,
    ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
    ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
  ],
  // Em coleta
  inPickup: [
    ShipmentStatus.COLLECTED_FROM_SENDER,
    ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
  ],
  // No ponto de coleta
  atPoC: [
    ShipmentStatus.DROPPED_OFF_AT_POINT,
    ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
    ShipmentStatus.COLLECTED_FROM_POINT,
  ],
  // Em trânsito (transportadora assumiu)
  inTransit: [
    ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
    ShipmentStatus.IN_TRANSFER,
    ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
    ShipmentStatus.AT_DESTINATION_HUB,
  ],
  // Em rota de entrega
  outForDelivery: [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.AWAITING_PICKUP_AT_DESTINATION_HUB,
  ],
  // Exceções/problemas
  exceptions: [
    ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
    ShipmentStatus.DELIVERY_PROBLEM,
    ShipmentStatus.PICKUP_FAILED,
  ],
  // Entregues
  delivered: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
  ],
  // Cancelados/devolvidos
  cancelled: [
    ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF,
    ShipmentStatus.CANCELLED_BEFORE_HANDOFF,
    ShipmentStatus.EXPIRED_NOT_POSTED,
    ShipmentStatus.CANCELLATION_REQUESTED_IN_TRANSIT,
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNING,
    ShipmentStatus.CANCELLED_IN_TRANSIT_RETURNED,
    ShipmentStatus.RETURNING_TO_SENDER,
    ShipmentStatus.RETURNED_TO_SENDER,
  ],
};

export const GET = withApiHandler<OpsKpis>(async (context) => {
  await requireAdminSession(context.req, AdminPermission.OPERACOES);

  // Buscar KPIs com cache SWR
  const kpis = await kpisCache.getOrSetSWR(fetchKpisFromDb);

  return { data: kpis };
});

/**
 * Busca KPIs diretamente do banco de dados.
 * Função interna usada pelo cache.
 */
async function fetchKpisFromDb(): Promise<OpsKpis> {
  // Executar todas as contagens em paralelo
  const [backlog, inPickup, atPoC, inTransit, outForDelivery, exceptions, delivered, cancelled] =
    await Promise.all([
      prisma.shipment.count({ where: { status: { in: STATUS_GROUPS.backlog } } }),
      prisma.shipment.count({ where: { status: { in: STATUS_GROUPS.inPickup } } }),
      prisma.shipment.count({ where: { status: { in: STATUS_GROUPS.atPoC } } }),
      prisma.shipment.count({ where: { status: { in: STATUS_GROUPS.inTransit } } }),
      prisma.shipment.count({ where: { status: { in: STATUS_GROUPS.outForDelivery } } }),
      prisma.shipment.count({ where: { status: { in: STATUS_GROUPS.exceptions } } }),
      prisma.shipment.count({ where: { status: { in: STATUS_GROUPS.delivered } } }),
      prisma.shipment.count({ where: { status: { in: STATUS_GROUPS.cancelled } } }),
    ]);

  return {
    backlog,
    inPickup,
    atPoC,
    inTransit,
    outForDelivery,
    exceptions,
    delivered,
    cancelled,
  };
}
