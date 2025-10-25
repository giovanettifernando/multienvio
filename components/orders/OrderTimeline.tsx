"use client";

import { Timeline, Typography } from "antd";
import type { OrderEvent } from "@/types/order";

const EVENT_LABEL: Record<OrderEvent["type"], string> = {
  CREATED: "Pedido criado",
  QUOTED: "Cotação gerada",
  SERVICE_SELECTED: "Serviço selecionado",
  LABEL_EMITTED: "Etiqueta emitida",
  CANCELED: "Cancelado",
  NOTE: "Observação",
};

type Props = {
  events: OrderEvent[];
};

export function OrderTimeline({ events }: Props) {
  return (
    <Timeline
      reverse
      items={events.map((event) => ({
        color:
          event.type === "LABEL_EMITTED"
            ? "green"
            : event.type === "CANCELED"
            ? "red"
            : "blue",
        children: (
          <div>
            <Typography.Text strong>{EVENT_LABEL[event.type]}</Typography.Text>
            <Typography.Paragraph style={{ margin: 0 }}>
              {event.description}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ margin: 0 }} type="secondary">
              {new Date(event.occurredAt).toLocaleString("pt-BR")}
            </Typography.Paragraph>
          </div>
        ),
      }))}
    />
  );
}
