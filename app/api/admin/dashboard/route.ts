/**
 * API de KPIs do Dashboard Administrativo
 *
 * Agrega métricas de:
 * - Operações (envios por status)
 * - Financeiro (saldo total, receita)
 * - Suporte (tickets abertos)
 * - Clientes (total de usuários)
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import prisma from '@/platform/db/db';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';

interface DashboardKpis {
  // Operações
  shipmentsBacklog: number;
  shipmentsInTransit: number;
  shipmentsExceptions: number;
  shipmentsDeliveredToday: number;

  // Financeiro
  totalWalletBalanceCents: number;
  revenueThisMonthCents: number;
  pendingExpensesCents: number;

  // Suporte
  ticketsOpen: number;
  ticketsHighPriority: number;

  // Clientes
  totalClients: number;
  activeClients: number;
}

// Status agrupados
const STATUS_BACKLOG = [
  ShipmentStatus.PICKUP_REQUESTED,
  ShipmentStatus.PICKUP_SCHEDULED,
  ShipmentStatus.AWAITING_PICKUP_AT_ORIGIN,
  ShipmentStatus.AWAITING_DROP_OFF_AT_POINT,
];

const STATUS_IN_TRANSIT = [
  ShipmentStatus.COLLECTED_FROM_SENDER,
  ShipmentStatus.IN_TRANSIT_TO_CARRIER_HUB,
  ShipmentStatus.DROPPED_OFF_AT_POINT,
  ShipmentStatus.AWAITING_CARRIER_PICKUP_AT_POINT,
  ShipmentStatus.COLLECTED_FROM_POINT,
  ShipmentStatus.RECEIVED_AT_ORIGIN_HUB,
  ShipmentStatus.IN_TRANSFER,
  ShipmentStatus.IN_TRANSIT_TO_DESTINATION,
  ShipmentStatus.AT_DESTINATION_HUB,
  ShipmentStatus.OUT_FOR_DELIVERY,
];

const STATUS_EXCEPTIONS = [
  ShipmentStatus.DELIVERY_ATTEMPT_FAILED,
  ShipmentStatus.DELIVERY_PROBLEM,
  ShipmentStatus.PICKUP_FAILED,
];

const STATUS_DELIVERED = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.DELIVERED_AT_DESTINATION_HUB,
];

export const GET = withApiHandler<DashboardKpis>(async (context) => {
  // Qualquer admin autenticado pode ver o dashboard
  await requireAdminSession(context.req);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Executar todas as queries em paralelo
  const [
    shipmentsBacklog,
    shipmentsInTransit,
    shipmentsExceptions,
    shipmentsDeliveredToday,
    walletAggregate,
    revenueAggregate,
    pendingExpensesAggregate,
    ticketsOpen,
    ticketsHighPriority,
    totalClients,
    activeClients,
  ] = await Promise.all([
    // Operações
    prisma.shipment.count({ where: { status: { in: STATUS_BACKLOG } } }),
    prisma.shipment.count({ where: { status: { in: STATUS_IN_TRANSIT } } }),
    prisma.shipment.count({ where: { status: { in: STATUS_EXCEPTIONS } } }),
    prisma.shipment.count({
      where: {
        status: { in: STATUS_DELIVERED },
        updatedAt: { gte: startOfToday },
      },
    }),

    // Financeiro - Saldo total de carteiras
    prisma.wallet.aggregate({
      _sum: { availableCents: true },
    }),

    // Receita do mês (TOPUPs confirmados)
    prisma.walletTransaction.aggregate({
      _sum: { amountCents: true },
      where: {
        type: 'TOPUP',
        status: 'CONFIRMED',
        createdAt: { gte: startOfMonth },
      },
    }),

    // Despesas pendentes
    prisma.expense.aggregate({
      _sum: { amountCents: true },
      where: { status: 'PENDING' },
    }),

    // Suporte - Tickets abertos
    prisma.supportTicket.count({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
    }),

    // Tickets de alta prioridade
    prisma.supportTicket.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        priority: 'HIGH',
      },
    }),

    // Clientes
    prisma.user.count(),
    prisma.user.count({ where: { status: 'active' } }),
  ]);

  return {
    data: {
      shipmentsBacklog,
      shipmentsInTransit,
      shipmentsExceptions,
      shipmentsDeliveredToday,
      totalWalletBalanceCents: walletAggregate._sum.availableCents ?? 0,
      revenueThisMonthCents: revenueAggregate._sum.amountCents ?? 0,
      pendingExpensesCents: pendingExpensesAggregate._sum.amountCents ?? 0,
      ticketsOpen,
      ticketsHighPriority,
      totalClients,
      activeClients,
    },
  };
});
