import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getCollectorSessionFromRequest } from '@/modules/auth/application/collector-session';
import { addMessageToTicketForCollector } from '@/modules/support/application/collector-service';
import { getTicketForCollector } from '@/modules/support/application/collector-service';
import { persistSupportAttachments } from '@/platform/storage/support-attachments';
import type { SupportMessage } from '@/shared/validation/support';

const MAX_FILES = 5;

type MessageCreateResponse = {
  message: SupportMessage;
};

export const POST = withApiHandler<MessageCreateResponse, { id: string }>(async ({ req, params }) => {
  const session = await getCollectorSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autenticado', status: 401 });
  }

  const ticketId = params.id;
  if (!ticketId) {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'Ticket inválido', status: 400 });
  }

  // Verificar se o ticket pertence ao coletor
  const ticket = await getTicketForCollector(ticketId, session.pointId);
  if (!ticket) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Ticket não encontrado', status: 404 });
  }

  const formData = await req.formData();
  const textField = formData.get('text');
  const text = typeof textField === 'string' ? textField.trim() : '';
  if (!text) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Mensagem obrigatória', status: 400 });
  }

  const files = formData
    .getAll('files')
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (files.length > MAX_FILES) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: `Envie no máximo ${MAX_FILES} arquivos por mensagem.`,
      status: 400,
    });
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

  return { data: { message }, status: 201 };
});
