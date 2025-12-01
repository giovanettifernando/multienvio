import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getTicketForUser } from "@/lib/support/service";


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const { id: ticketId } = await params;
  if (!ticketId) {
    return NextResponse.json({ message: "Ticket inválido" }, { status: 400 });
  }

  try {
    const ticket = await getTicketForUser(session.userId, ticketId);
    if (!ticket) {
      return NextResponse.json({ message: "Ticket não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ attachments: ticket.attachments ?? [] });
  } catch (error) {
    console.error("[SUPPORT_TICKET_ATTACHMENTS_GET]", error);
    return NextResponse.json({ message: "Erro ao carregar anexos" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { message: "Upload de anexos não implementado." },
    { status: 501 },
  );
}
