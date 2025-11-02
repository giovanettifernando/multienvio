import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { addMessageToTicket, getTicket } from '@/lib/support/service';
import { persistSupportAttachments } from '@/lib/storage/support-attachments';

export const dynamic = 'force-dynamic';

const MAX_FILES = 5;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const { id: ticketId } = await params;
  if (!ticketId) {
    return NextResponse.json({ message: 'Ticket inválido' }, { status: 400 });
  }

  try {
    const ticket = await getTicket(ticketId);
    if (!ticket) {
      return NextResponse.json({ message: 'Ticket não encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const textField = formData.get('text');
    const text = typeof textField === 'string' ? textField.trim() : '';
    if (!text) {
      return NextResponse.json({ message: 'Mensagem obrigatória' }, { status: 400 });
    }

    const internalField = formData.get('internal');
    const isInternal =
      typeof internalField === 'string'
        ? ['true', '1', 'on'].includes(internalField.toLowerCase())
        : false;

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
      authorId: session.staffId,
      role: 'admin',
      text,
      attachments,
      isInternal,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao enviar resposta';
    const status = message.includes('10 MB') ? 400 : 500;
    if (status === 500) {
      console.error('[ADMIN_SUPPORT_TICKET_REPLY]', error);
    }
    return NextResponse.json({ message }, { status });
  }
}
