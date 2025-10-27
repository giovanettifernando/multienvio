import { NextRequest, NextResponse } from "next/server";
import type {
  Ticket,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  TicketCategory,
} from "@/types/support";

export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __tickets: Map<string, Ticket> | undefined;
}

function getTicketStore(): Map<string, Ticket> {
  if (!globalThis.__tickets) {
    globalThis.__tickets = new Map();
  }
  return globalThis.__tickets;
}

const SLA_TARGET_HRS: Record<TicketPriority, number> = {
  LOW: 72,
  NORMAL: 48,
  HIGH: 24,
  URGENT: 4,
};

function recomputeSla(ticket: Ticket) {
  const hrs = ticket.priority ? SLA_TARGET_HRS[ticket.priority] : 48;
  const due = new Date(ticket.createdAt);
  due.setHours(due.getHours() + hrs);
  ticket.sla = {
    targetHrs: hrs,
    dueAt: due.toISOString(),
    breached:
      new Date().getTime() > due.getTime() &&
      ticket.status !== "RESOLVED" &&
      ticket.status !== "CLOSED",
  };
}

function pushEvent(ticket: Ticket, ev: TicketEvent) {
  ticket.events = [ev, ...ticket.events];
  ticket.updatedAt = ev.createdAt;
}

// GET /api/support/tickets/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const store = getTicketStore();
  const t = store.get(id);
  if (!t) {
    return NextResponse.json(
      { mensagem: "Ticket não encontrado" },
      { status: 404 },
    );
  }
  return NextResponse.json(t);
}

// PATCH /api/support/tickets/[id]
// Aceita campos parciais: title, category, priority, status, assignee
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const store = getTicketStore();
  const ticket = store.get(id);
  if (!ticket) {
    return NextResponse.json(
      { mensagem: "Ticket não encontrado" },
      { status: 404 },
    );
  }

  // parse seguro do body
  let bodyUnknown: unknown;
  try {
    bodyUnknown = await request.json();
  } catch {
    bodyUnknown = undefined;
  }
  const patch: {
    title?: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    status?: TicketStatus;
    assignee?: { id: string; name: string } | null;
  } = {};

  if (typeof bodyUnknown === "object" && bodyUnknown !== null) {
    const rec = bodyUnknown as Record<string, unknown>;
    if (typeof rec.title === "string") patch.title = rec.title;
    if (
      typeof rec.category === "string" &&
      ["FINANCEIRO", "LOGISTICA", "ETIQUETA", "RASTREAMENTO", "COLETAS", "OUTROS"].includes(
        rec.category,
      )
    ) {
      patch.category = rec.category as TicketCategory;
    }
    if (
      typeof rec.priority === "string" &&
      ["LOW", "NORMAL", "HIGH", "URGENT"].includes(rec.priority)
    ) {
      patch.priority = rec.priority as TicketPriority;
    }
    if (
      typeof rec.status === "string" &&
      ["OPEN", "PENDING", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"].includes(
        rec.status,
      )
    ) {
      patch.status = rec.status as TicketStatus;
    }
    if (rec.assignee === null) {
      patch.assignee = null;
    } else if (
      typeof rec.assignee === "object" &&
      rec.assignee !== null &&
      typeof (rec.assignee as Record<string, unknown>).id === "string" &&
      typeof (rec.assignee as Record<string, unknown>).name === "string"
    ) {
      patch.assignee = rec.assignee as { id: string; name: string };
    }
  }

  let changed = false;

  // title
  if (typeof patch.title === "string" && patch.title !== ticket.title) {
    ticket.title = patch.title;
    changed = true;
  }

  // category
  if (patch.category && patch.category !== ticket.category) {
    ticket.category = patch.category;
    changed = true;
  }

  // priority (recalcula SLA)
  if (patch.priority && patch.priority !== ticket.priority) {
    ticket.priority = patch.priority;
    recomputeSla(ticket);
    pushEvent(ticket, {
      id: `tke_${Math.random().toString(36).slice(2, 10)}`,
      type: "NOTE",
      message: `Prioridade alterada para ${ticket.priority}`,
      author: "AGENT",
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }

  // status (evitar duplicado)
  if (patch.status && patch.status !== ticket.status) {
    ticket.status = patch.status;
    pushEvent(ticket, {
      id: `tke_${Math.random().toString(36).slice(2, 10)}`,
      type: "STATUS_CHANGED",
      message: `Status alterado para ${ticket.status}`,
      author: "AGENT",
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }

  // assignee (evitar duplicado)
  if (
    (patch.assignee === null && ticket.assignee !== null) ||
    (patch.assignee &&
      (ticket.assignee?.id !== patch.assignee.id ||
        ticket.assignee?.name !== patch.assignee.name))
  ) {
    ticket.assignee = patch.assignee ?? null;
    pushEvent(ticket, {
      id: `tke_${Math.random().toString(36).slice(2, 10)}`,
      type: "ASSIGNED",
      message: patch.assignee
        ? `Atribuído a ${patch.assignee.name}`
        : "Atribuição removida",
      author: "AGENT",
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }

  if (changed) {
    store.set(id, ticket);
  }
  return NextResponse.json(ticket);
}
