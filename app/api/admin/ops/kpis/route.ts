import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { AdminPermission } from '@prisma/client';
import { canAccess } from '@/modules/auth/application/permissions';
import type { OpsKpis } from '@/modules/admin/application/ops/types';
import prisma from '@/platform/db/db';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';

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
  const session = await getAdminSessionFromRequest(context.req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const staffUser = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: { id: true, status: true, isSuperAdmin: true, permissions: true },
  });

  if (!staffUser || staffUser.status !== 'ACTIVE') {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  if (!canAccess(staffUser, AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Sem permissão para operações', status: 403 });
  }

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

  const kpis: OpsKpis = {
    backlog,
    inPickup,
    atPoC,
    inTransit,
    outForDelivery,
    exceptions,
    delivered,
    cancelled,
  };

  return { data: kpis };
});
