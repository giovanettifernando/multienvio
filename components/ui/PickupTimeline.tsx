"use client";

import { Timeline, Typography } from "antd";
import type { PickupEvent } from "@/types/pickup";

const LABELS: Record<PickupEvent["type"], string> = {
  REQUESTED: "Solicitada",
  SCHEDULED: "Agendada",
  ASSIGNED: "Motorista atribuído",
  PICKED_UP: "Coletada",
  FAILED: "Falha na coleta",
  CANCELED: "Cancelada",
  NOTE: "Observação",
};

type Props = {
  events: PickupEvent[];
};

export function PickupTimeline({ events }: Props) {
  return (
    <Timeline
      reverse
      items={events.map((event) => ({
        color:
          event.type === "PICKED_UP"
            ? "green"
            : event.type === "FAILED" || event.type === "CANCELED"
            ? "red"
            : "blue",
        children: (
          <div>
            <Typography.Text strong>{LABELS[event.type]}</Typography.Text>
            <Typography.Paragraph style={{ margin: 0 }}>
              {event.description}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ margin: 0 }} type="secondary">
              {new Date(event.occurredAt).toLocaleString("pt-BR")}
              {event.operator ? ` · ${event.operator}` : ""}
            </Typography.Paragraph>
          </div>
        ),
      }))}
    />
  );
}
