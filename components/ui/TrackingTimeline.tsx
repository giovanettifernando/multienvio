"use client";

import { Timeline, Typography } from "antd";
import type { TrackingEvent } from "@/types/tracking";

const TYPE_LABEL: Record<TrackingEvent["type"], string> = {
  CREATED: "Envio criado",
  PICKED_UP: "Coletado",
  IN_TRANSIT: "Em trânsito",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  DELAYED: "Atrasado",
  ISSUE: "Ocorrência",
};

type TrackingTimelineProps = {
  events: TrackingEvent[];
};

export function TrackingTimeline({ events }: TrackingTimelineProps) {
  return (
    <Timeline
      reverse
      items={events.map((event) => ({
        color: event.type === "DELIVERED" ? "green" : event.type === "ISSUE" ? "red" : "blue",
        children: (
          <div>
            <Typography.Text strong>{TYPE_LABEL[event.type]}</Typography.Text>
            <Typography.Paragraph style={{ margin: 0 }}>
              {event.description}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ margin: 0 }} type="secondary">
              {new Date(event.occurredAt).toLocaleString("pt-BR")}
              {" "}
              {event.city && event.uf ? `· ${event.city}/${event.uf}` : ""}
            </Typography.Paragraph>
          </div>
        ),
      }))}
    />
  );
}
