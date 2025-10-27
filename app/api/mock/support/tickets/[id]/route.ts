import { NextRequest, NextResponse } from "next/server";
import { supportDb } from "@/lib/support/mock-db";
import { ticketUpdateSchema } from "@/lib/support/schemas";
import { getAdminMockUser } from "@/lib/admin/mock-users";
import { getTicketCategoryLabel, getTicketStatusLabel } from "@/lib/support/utils";

export const dynamic = "force-dynamic";

function extractTicketId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (!segments.length) return null;
  const last = segments[segments.length - 1];
  if (last === "reply") {
    return segments[segments.length - 2] ?? null;
  }
  return last;
}

export async function GET(request: NextRequest) {
  const id = extractTicketId(request);
  if (!id) {
    return NextResponse.json({ mensagem: "Ticket inválido." }, { status: 400 });
  }
  const ticket = supportDb.findTicket(id);

  if (!ticket) {
    return NextResponse.json(
      { mensagem: "Ticket não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(ticket);
}

export async function PUT(request: NextRequest) {
  const id = extractTicketId(request);
  if (!id) {
    return NextResponse.json({ mensagem: "Ticket inválido." }, { status: 400 });
  }
  const existing = supportDb.findTicket(id);
  if (!existing) {
    return NextResponse.json(
      { mensagem: "Ticket não encontrado." },
      { status: 404 },
    );
  }

  try {
    const payload = await request.json();
    const result = ticketUpdateSchema.safeParse(payload);

    if (!result.success) {
      return NextResponse.json(
        { mensagem: "Dados inválidos.", erros: result.error.flatten() },
        { status: 400 },
      );
    }

    const data = result.data;
    const updates: Parameters<typeof supportDb.updateTicket>[1] = {};
    const timelineEvents: Array<{ type: "status" | "assign"; message: string }> = [];

    if (data.status && data.status !== existing.status) {
      updates.status = data.status;
      timelineEvents.push({
        type: "status",
        message: `Status alterado para ${getTicketStatusLabel(data.status)}.`,
      });
    }

    if (data.category && data.category !== existing.category) {
      updates.category = data.category;
      timelineEvents.push({
        type: "status",
        message: `Categoria atualizada para ${getTicketCategoryLabel(data.category)}.`,
      });
    }

    if (data.assigneeUserId !== undefined && data.assigneeUserId !== existing.assigneeUserId) {
      updates.assigneeUserId = data.assigneeUserId ?? null;
      if (!data.assigneeUserId) {
        timelineEvents.push({
          type: "assign",
          message: "Ticket marcado como não atribuído.",
        });
      } else {
        const assignee = getAdminMockUser(data.assigneeUserId);
        timelineEvents.push({
          type: "assign",
          message: assignee
            ? `Ticket atribuído a ${assignee.name}.`
            : "Ticket atribuído a um agente.",
        });
      }
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json(existing);
    }

    const updated = supportDb.updateTicket(id, updates);
    if (!updated) {
      return NextResponse.json(
        { mensagem: "Falha ao atualizar o ticket." },
        { status: 500 },
      );
    }

    for (const event of timelineEvents) {
      supportDb.addTimelineEvent(id, {
        type: event.type,
        author: "suporte",
        message: event.message,
      });
    }

    const ticket = supportDb.findTicket(id);
    return NextResponse.json(ticket);
  } catch (error) {
    const mensagem =
      error instanceof Error ? error.message : "Erro ao atualizar o ticket.";
    return NextResponse.json({ mensagem }, { status: 500 });
  }
}
