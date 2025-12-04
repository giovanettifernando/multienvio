"use client";

import type { PickupStatus } from "@/lib/types/pickup";
import { ELStatusTag, type StatusVariant } from "./ELStatusTag";

const STATUS_VARIANT: Record<PickupStatus, StatusVariant> = {
  PENDING: "warning",
  SCHEDULED: "processing",
  FAILED: "danger",
  CANCELED: "default",
  COMPLETED: "success",
};

const STATUS_LABEL: Record<PickupStatus, string> = {
  PENDING: "Pendente",
  SCHEDULED: "Agendada",
  FAILED: "Falhou",
  CANCELED: "Cancelada",
  COMPLETED: "Concluída",
};

type Props = {
  status: PickupStatus;
  showDot?: boolean;
};

export function PickupStatusTag({ status, showDot }: Props) {
  const variant = STATUS_VARIANT[status] ?? "default";
  const label = STATUS_LABEL[status] ?? status;
  return (
    <ELStatusTag variant={variant} showDot={showDot}>
      {label}
    </ELStatusTag>
  );
}
