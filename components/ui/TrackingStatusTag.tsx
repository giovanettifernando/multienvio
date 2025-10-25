"use client";

import { Tag } from "antd";
import type { TrackingEventType } from "@/types/tracking";

const STATUS_COLORS: Record<TrackingEventType, string> = {
  CREATED: "default",
  PICKED_UP: "blue",
  IN_TRANSIT: "processing",
  OUT_FOR_DELIVERY: "purple",
  DELIVERED: "success",
  DELAYED: "warning",
  ISSUE: "error",
};

const STATUS_LABEL: Record<TrackingEventType, string> = {
  CREATED: "Criado",
  PICKED_UP: "Coletado",
  IN_TRANSIT: "Em trânsito",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  DELAYED: "Atrasado",
  ISSUE: "Ocorrência",
};

type TrackingStatusTagProps = {
  status: TrackingEventType;
};

export function TrackingStatusTag({ status }: TrackingStatusTagProps) {
  return <Tag color={STATUS_COLORS[status]}>{STATUS_LABEL[status]}</Tag>;
}
