import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supportDb } from "@/lib/support/mock-db";
import { ticketFilterSchema, ticketCategoryValues } from "@/lib/support/schemas";
import type { SupportTicket } from "@/lib/support/types";
import { getAdminMockUser } from "@/lib/admin/mock-users";

export const dynamic = "force-dynamic";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
});

const ticketCreateSchema = z.object({
  title: z.string().min(3, "Informe um título."),
  description: z.string().min(1, "Descreva o problema."),
  category: z.enum([...ticketCategoryValues]),
  requester: z.object({
    name: z.string().min(2, "Informe o nome do solicitante."),
    email: z.string().email().optional(),
    phone: z.string().optional().nullable(),
    userId: z.string().optional(),
  }),
  linkedTrackingCode: z.string().optional().nullable(),
  assigneeUserId: z.string().optional().nullable(),
});

type TicketCreateInput = z.infer<typeof ticketCreateSchema>;

function buildCreatedTimeline(data: TicketCreateInput) {
  const createdAt = new Date();
  const commentAt = new Date(createdAt.getTime() + 1_000);
  const timeline: SupportTicket["timeline"] = [
    {
      id: randomUUID(),
      type: "comment",
      author: "cliente",
      message: data.description,
      at: commentAt.toISOString(),
    },
    {
      id: randomUUID(),
      type: "created",
      author: "cliente",
      message: `Ticket criado pelo cliente ${data.requester.name}.`,
      at: createdAt.toISOString(),
    },
  ];

  if (data.assigneeUserId) {
    const assignee = getAdminMockUser(data.assigneeUserId);
    const assignAt = new Date(createdAt.getTime() + 1_500);
    timeline.unshift({
      id: randomUUID(),
      type: "assign",
      author: "suporte",
      message: assignee
        ? `Ticket atribuído a ${assignee.name}.`
        : "Ticket atribuído a um agente.",
      at: assignAt.toISOString(),
    });
  }

  return { createdAt, timeline };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawFilters = {
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    assignee: searchParams.get("assignee") ?? undefined,
  };

  const filtersResult = ticketFilterSchema.safeParse(rawFilters);
  if (!filtersResult.success) {
    return NextResponse.json(
      { mensagem: "Parâmetros de busca inválidos." },
      { status: 400 },
    );
  }

  const paginationResult = paginationSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!paginationResult.success) {
    return NextResponse.json(
      { mensagem: "Parâmetros de paginação inválidos." },
      { status: 400 },
    );
  }

  const filters = filtersResult.data;
  const { page, pageSize } = paginationResult.data;
  const viewerId = searchParams.get("viewerId") ?? undefined;

  let tickets = [...supportDb.listTickets()];

  if (filters.q) {
    const text = filters.q.toLowerCase();
    tickets = tickets.filter((ticket) => {
      return (
        ticket.id.toLowerCase().includes(text) ||
        ticket.title.toLowerCase().includes(text) ||
        ticket.description.toLowerCase().includes(text) ||
        ticket.requester.name.toLowerCase().includes(text) ||
        ticket.requester.email?.toLowerCase().includes(text) ||
        ticket.linkedTrackingCode?.toLowerCase().includes(text)
      );
    });
  }

  if (filters.status && filters.status !== "all") {
    tickets = tickets.filter((ticket) => ticket.status === filters.status);
  }

  if (filters.category && filters.category !== "all") {
    tickets = tickets.filter((ticket) => ticket.category === filters.category);
  }

  if (filters.assignee === "unassigned") {
    tickets = tickets.filter((ticket) => !ticket.assigneeUserId);
  } else if (filters.assignee === "me") {
    if (!viewerId) {
      tickets = [];
    } else {
      tickets = tickets.filter((ticket) => ticket.assigneeUserId === viewerId);
    }
  }

  tickets.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const total = tickets.length;
  const start = (page - 1) * pageSize;
  const paged = tickets.slice(start, start + pageSize);

  return NextResponse.json({
    items: paged,
    total,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const result = ticketCreateSchema.safeParse(payload);

    if (!result.success) {
      return NextResponse.json(
        { mensagem: "Dados do ticket inválidos.", erros: result.error.flatten() },
        { status: 400 },
      );
    }

    const data = result.data;
    const { createdAt, timeline } = buildCreatedTimeline(data);
    const slaDueAt = new Date(createdAt.getTime() + 48 * 60 * 60 * 1_000).toISOString();

    const ticket = supportDb.createTicket(
      {
        title: data.title,
        description: data.description,
        status: "aberto",
        category: data.category,
        requester: {
          name: data.requester.name,
          email: data.requester.email ?? "",
          phone: data.requester.phone ?? null,
          userId: data.requester.userId,
        },
        linkedTrackingCode: data.linkedTrackingCode || null,
        assigneeUserId: data.assigneeUserId ?? null,
        slaDueAt,
      },
      {
        createdAt: createdAt.toISOString(),
      },
    );

    // ensure timeline created with correct timestamps and order
    ticket.timeline = timeline;
    ticket.updatedAt = timeline[0]?.at ?? ticket.updatedAt;

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    const mensagem =
      error instanceof Error ? error.message : "Não foi possível criar o ticket.";
    return NextResponse.json({ mensagem }, { status: 500 });
  }
}
