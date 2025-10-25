"use client";

import { Card, Space, Typography } from "antd";
import type { Ticket } from "@/types/support";

type Props = {
  related?: Ticket["related"];
};

export function RelatedEntities({ related }: Props) {
  if (!related) return null;
  return (
    <Card
      size="small"
      title="Vínculos"
      variant="borderless"
      styles={{ body: { paddingBlock: 12, paddingInline: 16 } }}
    >
      <Space direction="vertical" size={4}>
        {related.orderId ? (
          <Typography.Link href={`/pedidos/${related.orderId}`}>
            Pedido #{related.orderId}
          </Typography.Link>
        ) : null}
        {related.shipmentId ? (
          <Typography.Link href={`/shipments/${related.shipmentId}`}>
            Envio #{related.shipmentId}
          </Typography.Link>
        ) : null}
        {related.labelId ? (
          <Typography.Link href={`/rastreamento/${related.labelId}`}>
            Etiqueta #{related.labelId}
          </Typography.Link>
        ) : null}
      </Space>
    </Card>
  );
}
