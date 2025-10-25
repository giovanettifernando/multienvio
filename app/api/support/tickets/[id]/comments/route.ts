import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { Ticket, TicketEvent, SupportAttachment } from "@/types/support";

export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __tickets: Map<string, Ticket> | undefined;
  // eslint-disable-next-line no-var
  var __attachments: Map<string, SupportAttachment[]> | undefined;
}

function getTicketStore(): Map<string, Ticket> {
  if (!globalThis.__tickets) {
    globalThis.__tickets = new Map();
  }
  return globalThis.__tickets;
}

function getAttachmentStore(): Map<string, SupportAttachment[]> {
  if (!globalThis.__attachments) {
    globalThis.__attachments = new Map();
  }
  return globalThis.__attachments;
}

// POST /api/support/tickets/[id]/comments
// Espera JSON: { message: string; attachmentsIds?: string[] }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // parse seguro do body
  let bodyUnknown: unknown;
  try {
    bodyUnknown = await request.json();
  } catch {
    bodyUnknown = undefined;
  }

  let message: string | undefined;
  let attachmentsIds: string[] | undefined;

  if (typeof bodyUnknown === "object" && bodyUnknown !== null) {
    const rec = bodyUnknown as Record<string, unknown>;
    if (typeof rec.message === "string") message = rec.message.trim();
    if (Array.isArray(rec.attachmentsIds)) {
      attachmentsIds = rec.attachmentsIds.filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
    }
  }

  if (!message) {
    return NextResponse.json(
      { mensagem: "Mensagem é obrigatória" },
      { status: 400 },
    );
  }

  const tickets = getTicketStore();
  const ticket = tickets.get(id);
  if (!ticket) {
    return NextResponse.json(
      { mensagem: "Ticket não encontrado" },
      { status: 404 },
    );
  }

  // validar attachmentsIds pertencentes ao ticket
  const attStore = getAttachmentStore();
  const existing = attStore.get(id) ?? [];
  const validIds =
    attachmentsIds?.filter((aid) => existing.some((a) => a.id === aid)) ?? [];

  const event: TicketEvent = {
    id: `tke_${nanoid(8)}`,
    type: "COMMENT",
    message,
    author: "AGENT",
    createdAt: new Date().toISOString(),
    attachmentIds: validIds.length ? validIds : undefined,
  };

  ticket.events = [event, ...ticket.events];
  ticket.updatedAt = event.createdAt;
  tickets.set(id, ticket);

  // pequena latência mock
  await new Promise((r) => setTimeout(r, 150));

  return NextResponse.json(event, { status: 201 });
}
