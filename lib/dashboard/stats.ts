import type { Order } from "@/types/order";
import type { Shipment } from "@/types/shipment";

export type TrendDirection = "up" | "down" | "neutral";

export type KpiComputation = {
  key: string;
  label: string;
  value: number;
  previous: number;
  format: "number" | "currency";
  suffix?: string;
};

const ACTIVE_IN_TRANSIT: Shipment["status"][] = [
  "em_transito",
  "em_rota_de_entrega",
  "postado",
];

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const isoDate = new Date(value);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }
  const parts = value.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map((part) => Number.parseInt(part, 10));
    if (
      Number.isInteger(day) &&
      Number.isInteger(month) &&
      Number.isInteger(year)
    ) {
      const parsed = new Date(year, month - 1, day);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  return null;
}

function startOfDay(date: Date): Date {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function isBetween(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

function average(values: number[]): number {
  if (!values.length) return 0;
  const total = values.reduce((acc, value) => acc + value, 0);
  return total / values.length;
}

function percentageDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function trendFromDelta(delta: number): TrendDirection {
  if (delta > 1) return "up";
  if (delta < -1) return "down";
  return "neutral";
}

export function computeDashboardKpis(
  orders: Order[],
  shipments: Shipment[],
): KpiComputation[] {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  const dayBeforeYesterdayStart = new Date(yesterdayStart);
  dayBeforeYesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const ordersToday = orders.filter((order) => {
    const created = toDate(order.createdAt);
    return created ? created >= todayStart : false;
  });

  const ordersYesterday = orders.filter((order) => {
    const created = toDate(order.createdAt);
    if (!created) return false;
    return (
      created >= yesterdayStart &&
      created < todayStart
    );
  });

  const inTransitCurrent = shipments.filter((shipment) => {
    if (!ACTIVE_IN_TRANSIT.includes(shipment.status)) {
      return false;
    }
    const updatedAt = toDate(shipment.atualizadoEm);
    if (!updatedAt) return true;
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return updatedAt >= twentyFourHoursAgo;
  });

  const inTransitPrevious = shipments.filter((shipment) => {
    if (!ACTIVE_IN_TRANSIT.includes(shipment.status)) {
      return false;
    }
    const updatedAt = toDate(shipment.atualizadoEm);
    if (!updatedAt) return false;
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    return isBetween(updatedAt, fortyEightHoursAgo, twentyFourHoursAgo);
  });

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const deliveredLast7 = shipments.filter((shipment) => {
    if (shipment.status !== "entregue") return false;
    const updatedAt = toDate(shipment.atualizadoEm);
    if (!updatedAt) return false;
    return updatedAt >= sevenDaysAgo;
  });

  const deliveredPrev7 = shipments.filter((shipment) => {
    if (shipment.status !== "entregue") return false;
    const updatedAt = toDate(shipment.atualizadoEm);
    if (!updatedAt) return false;
    return isBetween(updatedAt, fourteenDaysAgo, sevenDaysAgo);
  });

  const overdueCurrent = shipments.filter((shipment) => {
    if (shipment.status === "entregue") return false;
    const dueDate = toDate(shipment.prazoEstimado);
    if (!dueDate) return false;
    return dueDate < now;
  });

  const overduePrevious = shipments.filter((shipment) => {
    if (shipment.status === "entregue") return false;
    const dueDate = toDate(shipment.prazoEstimado);
    if (!dueDate) return false;
    const sevenDaysBehind = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysBehind = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    return isBetween(dueDate, fourteenDaysBehind, sevenDaysBehind);
  });

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recentCosts = shipments
    .filter((shipment) => {
      const updatedAt = toDate(shipment.atualizadoEm);
      if (!updatedAt) return false;
      return updatedAt >= thirtyDaysAgo;
    })
    .map((shipment) => shipment.valorFrete ?? 0);

  const previousCosts = shipments
    .filter((shipment) => {
      const updatedAt = toDate(shipment.atualizadoEm);
      if (!updatedAt) return false;
      return isBetween(updatedAt, sixtyDaysAgo, thirtyDaysAgo);
    })
    .map((shipment) => shipment.valorFrete ?? 0);

  const currentAverageCost = average(recentCosts);
  const previousAverageCost = previousCosts.length
    ? average(previousCosts)
    : currentAverageCost || average(shipments.map((shipment) => shipment.valorFrete ?? 0));

  return [
    {
      key: "orders_today",
      label: "Pedidos hoje",
      value: ordersToday.length,
      previous: ordersYesterday.length,
      format: "number",
    },
    {
      key: "in_transit",
      label: "Em transporte",
      value: inTransitCurrent.length,
      previous: inTransitPrevious.length,
      format: "number",
    },
    {
      key: "delivered_week",
      label: "Entregues (7d)",
      value: deliveredLast7.length,
      previous: deliveredPrev7.length,
      format: "number",
    },
    {
      key: "overdue_sla",
      label: "Atrasados (SLA)",
      value: overdueCurrent.length,
      previous: overduePrevious.length,
      format: "number",
    },
    {
      key: "avg_cost",
      label: "Custo médio (30d)",
      value: Number(currentAverageCost.toFixed(2)),
      previous: Number((previousAverageCost || currentAverageCost).toFixed(2)),
      format: "currency",
    },
  ];
}

export function buildDelta(current: number, previous: number): {
  delta: number;
  trend: TrendDirection;
} {
  const delta = Number(percentageDelta(current, previous).toFixed(1));
  return {
    delta,
    trend: trendFromDelta(delta),
  };
}
