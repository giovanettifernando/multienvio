import { NextResponse } from "next/server";
import { customAlphabet, nanoid } from "nanoid";
import { ticketCreateSchema } from "@/lib/validation/support";
import { supportDb } from "@/lib/support/mock-db";
import type { TicketCategory as AdminTicketCategory } from "@/lib/support/types";
import type { Ticket, TicketEvent, TicketPriority } from "@/types/support";

export const dynamic = "force-dynamic";

declare global {
  var __tickets: Map<string, Ticket> | undefined;
}

const numberGenerator = customAlphabet("0123456789", 6);

function getTicketStore(): Map<string, Ticket> {
  if (!globalThis.__tickets) {
    globalThis.__tickets = new Map();
  }
  return globalThis.__tickets;
}

function priorityToHours(priority: TicketPriority): number {
  switch (priority) {
    case "LOW":
      return 72;
    case "NORMAL":
      return 48;
    case "HIGH":
      return 24;
    case "URGENT":
      return 4;
    default:
      return 48;
  }
}

function generateTicketNumber(createdAt: Date): string {
  return `TCK-${createdAt.getFullYear()}-${numberGenerator()}`;
}

function buildEvent(
  type: TicketEvent["type"],
  message: string,
  author: TicketEvent["author"] = "AGENT",
): TicketEvent {
  return {
    id: `tke_${nanoid(8)}`,
    type,
    message,
    author,
    createdAt: new Date().toISOString(),
  };
}

function mapCategory(category: Ticket["category"]): AdminTicketCategory {
  switch (category) {
    case "FINANCEIRO":
      return "pagamento";
    case "LOGISTICA":
    case "COLETAS":
      return "coleta";
    case "RASTREAMENTO":
      return "rastreio";
    case "ETIQUETA":
      return "outros";
    case "OUTROS":
    default:
      return "outros";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const search = searchParams.get("q")?.toLowerCase().trim() ?? "";
  const page = Math.max(Number.parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const sizeRaw = Number.parseInt(searchParams.get("size") ?? "20", 10) || 20;
  const size = Math.min(Math.max(sizeRaw, 1), 100);

  await new Promise((resolve) => setTimeout(resolve, 250));

  const store = getTicketStore();
  let tickets = Array.from(store.values());

  if (status) tickets = tickets.filter((ticket) => ticket.status === status);
  if (priority) tickets = tickets.filter((ticket) => ticket.priority === priority);
  if (category) tickets = tickets.filter((ticket) => ticket.category === category);
  if (search) {
    tickets = tickets.filter(
      (ticket) =>
        ticket.number.toLowerCase().includes(search) ||
        ticket.title.toLowerCase().includes(search) ||
        ticket.linkedTrackingCode?.toLowerCase().includes(search) ||
        ticket.related?.orderId?.toLowerCase().includes(search) ||
        ticket.related?.shipmentId?.toLowerCase().includes(search) ||
        ticket.related?.labelId?.toLowerCase().includes(search),
    );
  }

  tickets = tickets.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const total = tickets.length;
  const start = (page - 1) * size;
  const paginated = tickets.slice(start, start + size);

  return NextResponse.json({
    dados: paginated,
    page,
    size,
    total,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = ticketCreateSchema.parse(payload);

    await new Promise((resolve) => setTimeout(resolve, 250));

    const store = getTicketStore();
    const createdAt = new Date();
    const targetHrs = 48; // Default SLA since priority was removed
    const dueAt = new Date(createdAt.getTime() + targetHrs * 60 * 60 * 1000);

    let id = `tic_${nanoid(10)}`;
    while (store.has(id)) {
      id = `tic_${nanoid(10)}`;
    }

    const createdEvent = buildEvent("CREATED", "Ticket criado", "USER");
    const commentEvent = buildEvent("COMMENT", data.description, "USER");

    const ticket: Ticket = {
      id,
      number: generateTicketNumber(createdAt),
      title: data.title,
      category: data.category,
      priority: undefined,
      status: "OPEN",
      requester: data.requester,
      linkedTrackingCode: data.linkedTrackingCode,
      related: undefined,
      sla: {
        targetHrs,
        dueAt: dueAt.toISOString(),
      },
      assignee: null,
      createdAt: createdAt.toISOString(),
      updatedAt: commentEvent.createdAt,
      events: [commentEvent, createdEvent],
    };

    store.set(ticket.id, ticket);

    const maybeExisting = supportDb.findTicket(ticket.number);
    if (!maybeExisting) {
      const adminTicket = supportDb.createTicket(
        {
          title: ticket.title,
          description: data.description,
          status: "aberto",
          category: mapCategory(ticket.category),
          requester: {
            name: ticket.requester.name,
            email: ticket.requester.email ?? "",
            phone: ticket.requester.phone ?? data.requester.phone ?? null,
            userId: ticket.requester.email ?? undefined,
          },
          linkedTrackingCode: ticket.linkedTrackingCode ?? null,
          assigneeUserId: null,
          slaDueAt: ticket.sla?.dueAt ?? null,
        },
        { id: ticket.number, createdAt: ticket.createdAt },
      );

      supportDb.addTimelineEvent(adminTicket.id, {
        type: "comment",
        author: "cliente",
        message: data.description,
      });
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch {
    return NextResponse.json(
      { mensagem: "Não foi possível criar o ticket" },
      { status: 400 },
    );
  }
}
