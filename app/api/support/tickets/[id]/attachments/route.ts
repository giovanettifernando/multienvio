import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { SupportAttachment, Ticket, TicketEvent } from "@/types/support";

export const dynamic = "force-dynamic";

declare global {
  // stores em memória
  // (sem eslint-disable; não é necessário)
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

function buildAttachmentEvent(
  quantity: number,
  attachmentIds: string[],
): TicketEvent {
  return {
    id: `tke_${nanoid(8)}`,
    type: "ATTACHMENT",
    message: `${quantity} arquivo(s) anexado(s)`,
    author: "AGENT",
    createdAt: new Date().toISOString(),
    attachmentIds,
  };
}

// POST /api/support/tickets/[id]/attachments
// Espera JSON: { files: Array<{ fileName: string; size: number }> }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // parse seguro do body
  let payloadUnknown: unknown;
  try {
    payloadUnknown = await request.json();
  } catch {
    payloadUnknown = undefined;
  }

  type FileItem = { fileName: string; size: number };
  let files: FileItem[] | undefined;

  if (typeof payloadUnknown === "object" && payloadUnknown !== null) {
    const rec = payloadUnknown as Record<string, unknown>;
    const raw = rec.files;
    if (Array.isArray(raw)) {
      const valid: FileItem[] = [];
      for (const f of raw) {
        if (
          typeof f === "object" &&
          f !== null &&
          typeof (f as Record<string, unknown>).fileName === "string" &&
          typeof (f as Record<string, unknown>).size === "number"
        ) {
          valid.push({
            fileName: (f as Record<string, unknown>).fileName as string,
            size: (f as Record<string, unknown>).size as number,
          });
        }
      }
      files = valid;
    }
  }

  if (!files?.length) {
    return NextResponse.json(
      { mensagem: "Nenhum arquivo informado" },
      { status: 400 },
    );
  }

  const store = getTicketStore();
  const ticket = store.get(id);
  if (!ticket) {
    return NextResponse.json(
      { mensagem: "Ticket não encontrado" },
      { status: 404 },
    );
  }

  const attachmentStore = getAttachmentStore();
  const currentAttachments = attachmentStore.get(ticket.id) ?? [];

  const createdAt = new Date();
  const resolvedAttachments: SupportAttachment[] = [];
  const newlyCreated: SupportAttachment[] = [];

  for (const file of files) {
    const existing = currentAttachments.find(
      (attachment) =>
        attachment.fileName === file.fileName && attachment.size === file.size,
    );

    if (existing) {
      resolvedAttachments.push(existing);
      continue;
    }

    const attachment: SupportAttachment = {
      id: `att_${nanoid(8)}`,
      fileName: file.fileName,
      size: file.size,
      url: `/mock/support/${ticket.id}/${encodeURIComponent(file.fileName)}`,
      uploadedAt: createdAt.toISOString(),
    };
    newlyCreated.push(attachment);
    resolvedAttachments.push(attachment);
  }

  if (!resolvedAttachments.length) {
    return NextResponse.json(
      { mensagem: "Nenhum arquivo válido informado" },
      { status: 400 },
    );
  }

  if (newlyCreated.length) {
    const attachments = [...newlyCreated, ...currentAttachments];
    attachmentStore.set(ticket.id, attachments);

    const event = buildAttachmentEvent(
      newlyCreated.length,
      newlyCreated.map((attachment) => attachment.id),
    );
    ticket.events = [event, ...ticket.events];
    ticket.updatedAt = event.createdAt;
    store.set(ticket.id, ticket);
  }

  // simular latência
  await new Promise((resolve) => setTimeout(resolve, 200));

  return NextResponse.json(resolvedAttachments, {
    status: newlyCreated.length ? 201 : 200,
  });
}

// GET /api/support/tickets/[id]/attachments
export async function GET(
  _request: NextRequest,
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

  const attachmentStore = getAttachmentStore();
  const attachments = attachmentStore.get(ticket.id) ?? [];

  // simular latência
  await new Promise((resolve) => setTimeout(resolve, 150));

  return NextResponse.json({ attachments });
}
