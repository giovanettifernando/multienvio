"use client";

import { Tag } from "antd";
import type { ShipmentStatus } from "@/types/shipment";

type StatusConfig = {
  label: string;
  color: string;
};

const STATUS_CONFIG: Record<ShipmentStatus, StatusConfig> = {
  aguardando_coleta: {
    label: "Aguardando coleta",
    color: "default",
  },
  postado: {
    label: "Postado",
    color: "processing",
  },
  em_transito: {
    label: "Em trânsito",
    color: "blue",
  },
  em_rota_de_entrega: {
    label: "Em rota de entrega",
    color: "gold",
  },
  entregue: {
    label: "Entregue",
    color: "green",
  },
  pendente: {
    label: "Pendente",
    color: "red",
  },
};

type Props = {
  status: ShipmentStatus;
};

export function ShipmentStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status];

  return <Tag color={config.color}>{config.label}</Tag>;
}
