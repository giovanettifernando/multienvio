import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { addMessageToTicket, getTicketForUser } from '@/modules/support/application/service';
import { persistSupportAttachments } from '@/platform/storage/support-attachments';
import { logger } from '@/platform/logging/logger';
import type { SupportMessage } from '@/shared/validation/support';


const MAX_FILES = 5;

export const POST = withApiHandler<SupportMessage, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const ticketId = context.params.id;
  if (!ticketId) {
    throw new ApiError({ code: 'validation_error', message: 'Ticket inválido', status: 400 });
  }

  const ticket = await getTicketForUser(session.userId, ticketId);
  if (!ticket) {
    throw new ApiError({ code: 'not_found', message: 'Ticket não encontrado', status: 404 });
  }

  const formData = await context.req.formData();
  const textField = formData.get('text');
  const text = typeof textField === 'string' ? textField.trim() : '';

  if (!text) {
    throw new ApiError({ code: 'validation_error', message: 'Mensagem obrigatória', status: 400 });
  }

  const files = formData
    .getAll('files')
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (files.length > MAX_FILES) {
    throw new ApiError({
      code: 'validation_error',
      message: `Envie no máximo ${MAX_FILES} arquivos por mensagem.`,
      status: 400,
    });
  }

  try {
    const attachments = await persistSupportAttachments(ticketId, files);

    const message = await addMessageToTicket({
      ticketId,
      authorId: session.userId,
      role: 'cliente',
      text,
      attachments,
    });

    logger.info({ event: 'ticket_message_created', ticketId, userId: session.userId }, 'Ticket message created');

    return { data: message, status: 201 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
    if (errorMessage.includes('10 MB')) {
      throw new ApiError({ code: 'validation_error', message: errorMessage, status: 400 });
    }
    throw error;
  }
});
