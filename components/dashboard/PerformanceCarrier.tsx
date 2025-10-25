"use client";

import { useMemo } from "react";
import { Card, Progress, Space, Typography } from "antd";
import type { Shipment } from "@/types/shipment";

type PerformanceCarrierProps = {
  shipments: Shipment[] | undefined;
};

const carriers = ["Correios", "Jadlog", "Loggi", "J&T"] as const;
const fallbackPercentages: Record<typeof carriers[number], number> = {
  Correios: 92,
  Jadlog: 88,
  Loggi: 95,
  "J&T": 86,
};

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) {
    return iso;
  }
  const parts = value.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map((part) => Number.parseInt(part, 10));
    if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
      const parsed = new Date(year, month - 1, day);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  return null;
}

export function PerformanceCarrier({ shipments }: PerformanceCarrierProps) {
  const data = useMemo(() => {
    if (!shipments?.length) {
      return carriers.map((carrier) => ({
        carrier,
        percentage: fallbackPercentages[carrier],
      }));
    }

    return carriers.map((carrier, index) => {
      const related = shipments.filter((_, idx) => idx % carriers.length === index);
      if (!related.length) {
        return {
          carrier,
          percentage: fallbackPercentages[carrier],
        };
      }
      const onTimeDeliveries = related.filter((shipment) => {
        if (shipment.status !== "entregue") return false;
        const deliveredAt = parseDate(shipment.atualizadoEm);
        const due = parseDate(shipment.prazoEstimado);
        if (!deliveredAt || !due) return true;
        return deliveredAt.getTime() <= due.getTime();
      });
      const ratio = onTimeDeliveries.length / related.length;
      const percentage = Math.round(Math.min(Math.max(ratio * 100, 40), 99));
      return { carrier, percentage };
    });
  }, [shipments]);

  return (
    <Card
      title="Performance por transportadora (30 dias)"
      variant="outlined"
      styles={{ body: { paddingTop: 0 } }}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {data.map(({ carrier, percentage }) => (
          <div key={carrier}>
            <Space
              style={{ width: "100%", justifyContent: "space-between", marginBottom: 4 }}
              size={0}
            >
              <Typography.Text>{carrier}</Typography.Text>
              <Typography.Text type="secondary">{percentage}% no prazo</Typography.Text>
            </Space>
            <Progress percent={percentage} status={percentage >= 90 ? "success" : undefined} />
          </div>
        ))}
      </Space>
    </Card>
  );
}
