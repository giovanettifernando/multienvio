export type TicketStatus =
  | "OPEN"
  | "PENDING"
  | "WAITING_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type TicketCategory =
  | "FINANCEIRO"
  | "LOGISTICA"
  | "ETIQUETA"
  | "RASTREAMENTO"
  | "COLETAS"
  | "OUTROS";

export type TicketEvent = {
  id: string;
  type:
    | "CREATED"
    | "STATUS_CHANGED"
    | "ASSIGNED"
    | "COMMENT"
    | "ATTACHMENT"
    | "SLA_BREACH"
    | "NOTE";
  message: string;
  author: "USER" | "AGENT" | "SYSTEM";
  createdAt: string;
  attachmentIds?: string[];
};

export type Ticket = {
  id: string;
  number: string;
  title: string;
  category: TicketCategory;
  priority?: TicketPriority; // Optional for backward compatibility
  status: TicketStatus;
  requester: {
    name: string;
    email?: string;
    phone?: string;
  };
  linkedTrackingCode?: string;
  related?: {
    orderId?: string;
    shipmentId?: string;
    labelId?: string;
  };
  sla?: {
    targetHrs: number;
    dueAt: string;
    breached?: boolean;
  };
  assignee?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  events: TicketEvent[];
};

export type SupportAttachment = {
  id: string;
  fileName: string;
  size: number;
  url: string;
  uploadedAt: string;
};
