import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { Ticket, TicketEvent } from "@/types/support";

export const dynamic = "force-dynamic";

type SupportedWebhookCode = "SLA_CHECK" | "AUTOCLOSE_RESOLVED";

declare global {
  var __tickets: Map<string, Ticket> | undefined;
}

function getTicketStore(): Map<string, Ticket> {
  if (!globalThis.__tickets) {
    globalThis.__tickets = new Map();
  }
  return globalThis.__tickets;
}

function buildEvent(type: TicketEvent["type"], message: string): TicketEvent {
  return {
    id: `tke_${nanoid(8)}`,
    type,
    message,
    author: "SYSTEM",
    createdAt: new Date().toISOString(),
  };
}

function handleSlaCheck(ticket: Ticket): boolean {
  const dueAt = ticket.sla?.dueAt ? new Date(ticket.sla.dueAt) : null;
  const alreadyBreached = Boolean(ticket.sla?.breached);
  const isCompleted = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  if (!dueAt || isCompleted || alreadyBreached) {
    return false;
  }

  if (new Date() <= dueAt) {
    return false;
  }


  const DEFAULT_TARGET_HRS = 48;

const targetHrs =
  ticket.sla?.targetHrs ??
  /* SLA_TARGET_HRS?.[ticket.priority] ?? */ DEFAULT_TARGET_HRS;

const base = new Date(ticket.createdAt);
const due = ticket.sla?.dueAt
  ? new Date(ticket.sla.dueAt)
  : new Date(base.setHours(base.getHours() + targetHrs));

ticket.sla = {
  targetHrs,
  dueAt: due.toISOString(),
  breached: true,
};


  const event = buildEvent("SLA_BREACH", "SLA vencido");
  ticket.events = [event, ...ticket.events];
  ticket.updatedAt = event.createdAt;
  return true;
}

function handleAutoCloseResolved(ticket: Ticket): boolean {
  if (ticket.status !== "RESOLVED") {
    return false;
  }

  const resolvedEvent = ticket.events.find(
    (event) => event.type === "STATUS_CHANGED" && event.message.includes("RESOLVED"),
  );

  if (!resolvedEvent) {
    return false;
  }

  const resolvedAt = new Date(resolvedEvent.createdAt);
  const elapsedMs = Date.now() - resolvedAt.getTime();
  const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

  if (elapsedMs < twentyFourHoursInMs) {
    return false;
  }

  ticket.status = "CLOSED";
  const event = buildEvent("STATUS_CHANGED", "Ticket encerrado automaticamente");
  ticket.events = [event, ...ticket.events];
  ticket.updatedAt = event.createdAt;
  return true;
}

export async function POST(request: Request) {
  const payload = await request.json();
  const ticketId = typeof payload?.ticketId === "string" ? payload.ticketId : undefined;
  const code = payload?.code as SupportedWebhookCode | undefined;
  const message = typeof payload?.message === "string" ? payload.message : undefined;

  if (!ticketId || !code) {
    return NextResponse.json(
      { mensagem: "Informe ticketId e code" },
      { status: 400 },
    );
  }

  if (code !== "SLA_CHECK" && code !== "AUTOCLOSE_RESOLVED") {
    return NextResponse.json(
      { mensagem: "Webhook não suportado" },
      { status: 400 },
    );
  }

  const store = getTicketStore();
  const ticket = store.get(ticketId);

  if (!ticket) {
    return NextResponse.json(
      { mensagem: "Ticket não encontrado" },
      { status: 404 },
    );
  }

  let updated = false;

  if (code === "SLA_CHECK") {
    updated = handleSlaCheck(ticket) || updated;
  }

  if (code === "AUTOCLOSE_RESOLVED") {
    updated = handleAutoCloseResolved(ticket) || updated;
  }

  if (message) {
    const note = buildEvent("NOTE", message);
    ticket.events = [note, ...ticket.events];
    ticket.updatedAt = note.createdAt;
    updated = true;
  }

  if (updated) {
    store.set(ticket.id, ticket);
  }

  await new Promise((resolve) => setTimeout(resolve, 150));

  return NextResponse.json(ticket);
}
