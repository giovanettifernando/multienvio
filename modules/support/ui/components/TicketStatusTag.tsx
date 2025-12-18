"use client";

import type { Status } from '@/shared/validation/support';
import { ELStatusTag, type StatusVariant } from '@/shared/ui/ELStatusTag';

const STATUS_VARIANT: Record<Status, StatusVariant> = {
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
  showDot?: boolean;
};

export function TicketStatusTag({ status, showDot }: Props) {
  return (
    <ELStatusTag variant={STATUS_VARIANT[status]} showDot={showDot}>
      {STATUS_LABEL[status]}
    </ELStatusTag>
  );
}
