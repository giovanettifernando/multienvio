import { NextRequest, NextResponse } from "next/server";
import { supportDb } from "@/lib/support/mock-db";
import { ticketReplySchema } from "@/lib/support/schemas";

export const dynamic = "force-dynamic";

function extractTicketId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const last = segments[segments.length - 1];
  if (last !== "reply") return null;
  return segments[segments.length - 2] ?? null;
}

export async function POST(request: NextRequest) {
  const id = extractTicketId(request);
  if (!id) {
    return NextResponse.json(
      { mensagem: "Ticket inválido." },
      { status: 400 },
    );
  }
  const ticket = supportDb.findTicket(id);

  if (!ticket) {
    return NextResponse.json(
      { mensagem: "Ticket não encontrado." },
      { status: 404 },
    );
  }

  try {
    const payload = await request.json();
    const result = ticketReplySchema.safeParse(payload);

    if (!result.success) {
      return NextResponse.json(
        { mensagem: "Resposta inválida.", erros: result.error.flatten() },
        { status: 400 },
      );
    }

    const { message } = result.data;

    const event = supportDb.addTimelineEvent(id, {
      type: "comment",
      author: "suporte",
      message,
    });

    if (!event) {
      return NextResponse.json(
        { mensagem: "Não foi possível registrar a resposta." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, ticket: supportDb.findTicket(id) });
  } catch (error) {
    const mensagem =
      error instanceof Error ? error.message : "Erro ao enviar resposta.";
    return NextResponse.json({ mensagem }, { status: 500 });
  }
}
