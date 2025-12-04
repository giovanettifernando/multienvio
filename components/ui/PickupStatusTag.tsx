"use client";

import type { PickupStatus } from "@/types/pickup";
import { ELStatusTag, type StatusVariant } from "./ELStatusTag";

const STATUS_VARIANT: Record<PickupStatus, StatusVariant> = {
  REQUESTED: "default",
  SCHEDULED: "processing",
  ASSIGNED: "info",
  PICKED_UP: "success",
  FAILED: "warning",
  CANCELED: "danger",
};

const STATUS_LABEL: Record<PickupStatus, string> = {
  REQUESTED: "Solicitada",
  SCHEDULED: "Agendada",
  ASSIGNED: "Motorista atribuído",
  PICKED_UP: "Coletada",
  FAILED: "Falha",
  CANCELED: "Cancelada",
};

type Props = {
  status: PickupStatus;
  showDot?: boolean;
};

export function PickupStatusTag({ status, showDot }: Props) {
  return (
    <ELStatusTag variant={STATUS_VARIANT[status]} showDot={showDot}>
      {STATUS_LABEL[status]}
    </ELStatusTag>
  );
}
