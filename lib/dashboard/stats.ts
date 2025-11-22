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

  // Current month calculation
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const ordersThisMonth = orders.filter((order) => {
    const created = toDate(order.createdAt);
    return created ? created >= currentMonthStart : false;
  });

  const ordersLastMonth = orders.filter((order) => {
    const created = toDate(order.createdAt);
    if (!created) return false;
    return created >= previousMonthStart && created <= previousMonthEnd;
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

  // Calculate on-time delivery percentage
  const deliveredThisMonth = shipments.filter((shipment) => {
    if (shipment.status !== "entregue") return false;
    const updatedAt = toDate(shipment.atualizadoEm);
    if (!updatedAt) return false;
    return updatedAt >= currentMonthStart;
  });

  const onTimeDeliveries = deliveredThisMonth.filter((shipment) => {
    const deliveredDate = toDate(shipment.atualizadoEm);
    const dueDate = toDate(shipment.prazoEstimado);
    if (!deliveredDate || !dueDate) return false;
    return deliveredDate <= dueDate;
  });

  const onTimePercentage = deliveredThisMonth.length > 0
    ? (onTimeDeliveries.length / deliveredThisMonth.length) * 100
    : 0;

  const deliveredLastMonth = shipments.filter((shipment) => {
    if (shipment.status !== "entregue") return false;
    const updatedAt = toDate(shipment.atualizadoEm);
    if (!updatedAt) return false;
    return updatedAt >= previousMonthStart && updatedAt <= previousMonthEnd;
  });

  const onTimeDeliveriesLastMonth = deliveredLastMonth.filter((shipment) => {
    const deliveredDate = toDate(shipment.atualizadoEm);
    const dueDate = toDate(shipment.prazoEstimado);
    if (!deliveredDate || !dueDate) return false;
    return deliveredDate <= dueDate;
  });

  const onTimePercentageLastMonth = deliveredLastMonth.length > 0
    ? (onTimeDeliveriesLastMonth.length / deliveredLastMonth.length) * 100
    : 0;

  return [
    {
      key: "orders_month",
      label: "Pedidos no mês",
      value: ordersThisMonth.length,
      previous: ordersLastMonth.length,
      format: "number",
    },
    {
      key: "avg_cost",
      label: "Custo médio",
      value: Number(currentAverageCost.toFixed(2)),
      previous: Number((previousAverageCost || currentAverageCost).toFixed(2)),
      format: "currency",
    },
    {
      key: "on_time_delivery",
      label: "Entregas no prazo",
      value: Number(onTimePercentage.toFixed(1)),
      previous: Number(onTimePercentageLastMonth.toFixed(1)),
      format: "number",
      suffix: "%",
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
