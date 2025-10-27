import type { TicketCategory, TicketStatus } from "./types";

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Aberto",
  pendente: "Pendente",
  respondido: "Respondido",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const TICKET_STATUS_COLOR: Record<TicketStatus, string> = {
  aberto: "blue",
  pendente: "gold",
  respondido: "green",
  resolvido: "purple",
  fechado: "default",
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  integracao: "Integração",
  pagamento: "Pagamento",
  coleta: "Coleta",
  rastreio: "Rastreamento",
  outros: "Outros",
};

export function getTicketStatusLabel(status: TicketStatus): string {
  return TICKET_STATUS_LABEL[status] ?? status;
}

export function getTicketCategoryLabel(category: TicketCategory): string {
  return TICKET_CATEGORY_LABEL[category] ?? category;
}
