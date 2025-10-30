"use client";

import { Tag } from "antd";
import { SupportStatus } from "@/types/contracts";
import type { TicketStatus } from "@/types/support";

const STATUS_COLOR: Record<TicketStatus, string> = {
  [SupportStatus.ABERTO]: "processing",
  [SupportStatus.EM_ATENDIMENTO]: "warning",
  [SupportStatus.RESOLVIDO]: "success",
  [SupportStatus.FECHADO]: "default",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  [SupportStatus.ABERTO]: "Aberto",
  [SupportStatus.EM_ATENDIMENTO]: "Em Atendimento",
  [SupportStatus.RESOLVIDO]: "Resolvido",
  [SupportStatus.FECHADO]: "Fechado",
};

type Props = {
  status: TicketStatus;
};

export function TicketStatusTag({ status }: Props) {
  return <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>;
}
