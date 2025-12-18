/**
 * Support types migrated to use global contracts
 */

import {
  SupportStatus,
  SupportPriority,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_COLORS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_PRIORITY_COLORS,
  type SupportTicket as GlobalSupportTicket,
  type SupportMessage as GlobalSupportMessage,
} from "./contracts";

// Re-export for convenience
export { SupportStatus, SupportPriority };
export { SUPPORT_STATUS_LABELS, SUPPORT_STATUS_COLORS };
export { SUPPORT_PRIORITY_LABELS, SUPPORT_PRIORITY_COLORS };

// Legacy type aliases for backward compatibility
export type TicketStatus = SupportStatus;
export type TicketPriority = SupportPriority;
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
    phone?: string | null;
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
