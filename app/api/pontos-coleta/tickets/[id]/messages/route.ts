export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';
import { addMessageToTicketForCollector } from '@/lib/support/collector-service';
import { getTicketForCollector } from '@/lib/support/collector-service';
import { persistSupportAttachments } from '@/lib/storage/support-attachments';

const MAX_FILES = 5;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCollectorSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id: ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ message: 'Ticket inválido' }, { status: 400 });
    }

    // Verificar se o ticket pertence ao coletor
    const ticket = await getTicketForCollector(ticketId, session.pointId);
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

    const rawAttachments = await persistSupportAttachments(ticketId, files);
    const attachments = rawAttachments.map(({ name, url, size }) => ({
      filename: name,
      url,
      size,
    }));

    const message = await addMessageToTicketForCollector(
      ticketId,
      session.pointId,
      text,
      attachments
    );

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao adicionar mensagem';
    const status = message.includes('10 MB') ? 400 : 500;
    if (status === 500) {
      console.error('[COLLECTOR_TICKET_MESSAGE_POST]', error);
    }
    return NextResponse.json({ message }, { status });
  }
}
