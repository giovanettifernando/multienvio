"use client";

import type { TrackingEventType } from "@/types/tracking";
import { ELStatusTag, type StatusVariant } from "./ELStatusTag";

const STATUS_VARIANT: Record<TrackingEventType, StatusVariant> = {
  CREATED: "default",
  PICKED_UP: "info",
  IN_TRANSIT: "processing",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  DELAYED: "warning",
  ISSUE: "danger",
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
  showDot?: boolean;
};

export function TrackingStatusTag({ status, showDot }: TrackingStatusTagProps) {
  return (
    <ELStatusTag variant={STATUS_VARIANT[status]} showDot={showDot}>
      {STATUS_LABEL[status]}
    </ELStatusTag>
  );
}
