/**
 * StatusTag - Tag de status unificada
 *
 * Centraliza cores e labels de status para diferentes entidades:
 * - Shipments (envios)
 * - Pickups (coletas)
 * - Tickets (suporte)
 * - Payments (pagamentos)
 *
 * Uso:
 * <StatusTag type="shipment" status="Em trânsito" />
 * <StatusTag type="pickup" status="PENDING" />
 * <StatusTag type="ticket" status="aberto" />
 */
import { Tag } from "antd";
import type { TagProps } from "antd";

// Tipos de status por entidade
export type ShipmentStatus =
  | "Aguardando coleta"
  | "Aguardando postagem"
  | "Postado"
  | "Em trânsito"
  | "Em rota de entrega"
  | "Entregue"
  | "Cancelado"
  | "Devolvido";

export type PickupStatus =
  | "PENDING"
  | "SCHEDULED"
  | "FAILED"
  | "CANCELED"
  | "COMPLETED";

export type TicketStatus =
  | "aberto"
  | "em_atendimento"
  | "resolvido"
  | "fechado";

export type PaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "refunded"
  | "cancelled";

// Mapeamento de cores
const SHIPMENT_COLORS: Record<ShipmentStatus, string> = {
  "Aguardando coleta": "default",
  "Aguardando postagem": "default",
  "Postado": "geekblue",
  "Em trânsito": "blue",
  "Em rota de entrega": "gold",
  "Entregue": "green",
  "Cancelado": "red",
  "Devolvido": "orange",
};

const PICKUP_COLORS: Record<PickupStatus, string> = {
  PENDING: "orange",
  SCHEDULED: "blue",
  FAILED: "red",
  CANCELED: "default",
  COMPLETED: "green",
};

const PICKUP_LABELS: Record<PickupStatus, string> = {
  PENDING: "Pendente",
  SCHEDULED: "Agendada",
  FAILED: "Falhou",
  CANCELED: "Cancelada",
  COMPLETED: "Concluída",
};

const TICKET_COLORS: Record<TicketStatus, string> = {
  aberto: "processing",
  em_atendimento: "warning",
  resolvido: "success",
  fechado: "default",
};

const TICKET_LABELS: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_atendimento: "Em Atendimento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  pending: "orange",
  approved: "green",
  rejected: "red",
  refunded: "purple",
  cancelled: "default",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

// Props do componente
type StatusTagProps = Omit<TagProps, "color" | "children"> & (
  | { type: "shipment"; status: ShipmentStatus }
  | { type: "pickup"; status: PickupStatus }
  | { type: "ticket"; status: TicketStatus }
  | { type: "payment"; status: PaymentStatus }
  | { type: "generic"; status: string; color?: string }
);

export function StatusTag(props: StatusTagProps) {
  const { type, status, ...tagProps } = props;

  let color: string;
  let label: string;

  switch (type) {
    case "shipment":
      color = SHIPMENT_COLORS[status as ShipmentStatus] ?? "default";
      label = status; // Shipment já usa labels em português
      break;

    case "pickup":
      color = PICKUP_COLORS[status as PickupStatus] ?? "default";
      label = PICKUP_LABELS[status as PickupStatus] ?? status;
      break;

    case "ticket":
      color = TICKET_COLORS[status as TicketStatus] ?? "default";
      label = TICKET_LABELS[status as TicketStatus] ?? status;
      break;

    case "payment":
      color = PAYMENT_COLORS[status as PaymentStatus] ?? "default";
      label = PAYMENT_LABELS[status as PaymentStatus] ?? status;
      break;

    case "generic":
    default:
      color = (props as { color?: string }).color ?? "default";
      label = status;
      break;
  }

  return (
    <Tag color={color} {...tagProps}>
      {label}
    </Tag>
  );
}

// Re-exportar constantes para uso direto quando necessário
export {
  SHIPMENT_COLORS,
  PICKUP_COLORS,
  PICKUP_LABELS,
  TICKET_COLORS,
  TICKET_LABELS,
  PAYMENT_COLORS,
  PAYMENT_LABELS,
};

export default StatusTag;
