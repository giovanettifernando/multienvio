"use client";

import { Tag } from "antd";
import type { TicketStatus } from "@/types/support";

const STATUS_COLOR: Record<TicketStatus, string> = {
  OPEN: "processing",
  PENDING: "warning",
  WAITING_CUSTOMER: "gold",
  RESOLVED: "success",
  CLOSED: "default",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  PENDING: "Pendente",
  WAITING_CUSTOMER: "Aguardando cliente",
  RESOLVED: "Resolvido",
  CLOSED: "Fechado",
};

type Props = {
  status: TicketStatus;
};

export function TicketStatusTag({ status }: Props) {
  return <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>;
}
