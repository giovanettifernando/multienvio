import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { addMessageToTicket, getTicketForUser } from '@/lib/support/service';
import { persistSupportAttachments } from '@/lib/storage/support-attachments';

export const dynamic = 'force-dynamic';

const MAX_FILES = 5;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const { id: ticketId } = await params;
  if (!ticketId) {
    return NextResponse.json({ message: 'Ticket inválido' }, { status: 400 });
  }

  try {
    const ticket = await getTicketForUser(session.userId, ticketId);
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket não encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const textField = formData.get('text');
    const text = typeof textField === 'string' ? textField.trim() : '';
    if (!text) {
      return NextResponse.json({ message: 'Mensagem obrigatória' }, { status: 400 });
    }

    const files = formData
      .getAll('files')
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { message: `Envie no máximo ${MAX_FILES} arquivos por mensagem.` },
        { status: 400 },
      );
    }

    const attachments = await persistSupportAttachments(ticketId, files);

    const message = await addMessageToTicket({
      ticketId,
      authorId: session.userId,
      role: 'cliente',
      text,
      attachments,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao enviar mensagem';
    const status = message.includes('10 MB') ? 400 : 500;
    if (status === 500) {
      console.error('[SUPPORT_TICKET_MESSAGE_POST]', error);
    }
    return NextResponse.json({ message }, { status });
  }
}
