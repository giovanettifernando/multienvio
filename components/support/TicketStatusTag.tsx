"use client";

import { Tag } from "antd";
import type { Status } from "@/lib/validation/support";

const STATUS_COLOR: Record<Status, string> = {
  aberto: "processing",
  em_atendimento: "warning",
  resolvido: "success",
  fechado: "default",
};

const STATUS_LABEL: Record<Status, string> = {
  aberto: "Aberto",
  em_atendimento: "Em Atendimento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

type Props = {
  status: Status;
};

export function TicketStatusTag({ status }: Props) {
  return <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>;
}
