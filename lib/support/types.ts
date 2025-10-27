export type TicketStatus =
  | "aberto"
  | "pendente"
  | "respondido"
  | "resolvido"
  | "fechado";

export type TicketCategory =
  | "integracao"
  | "pagamento"
  | "coleta"
  | "rastreio"
  | "outros";

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory;
  requester: {
    name: string;
    email: string;
    phone?: string | null;
    userId?: string;
  };
  linkedTrackingCode?: string | null;
  assigneeUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  slaDueAt?: string | null;
  timeline: Array<{
    id: string;
    type: "created" | "comment" | "status" | "assign";
    author: "cliente" | "suporte";
    message?: string;
    at: string;
  }>;
}
