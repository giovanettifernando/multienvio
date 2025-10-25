"use client";

import { Tag } from "antd";
import type { PickupStatus } from "@/types/pickup";

const STATUS_COLOR: Record<PickupStatus, string> = {
  REQUESTED: "default",
  SCHEDULED: "processing",
  ASSIGNED: "blue",
  PICKED_UP: "success",
  FAILED: "warning",
  CANCELED: "error",
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
};

export function PickupStatusTag({ status }: Props) {
  return <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>;
}
