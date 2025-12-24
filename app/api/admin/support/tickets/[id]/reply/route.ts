import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { addMessageToTicket, getTicket } from '@/modules/support/application/service';
import { persistSupportAttachments } from '@/platform/storage/support-attachments';


const MAX_FILES = 5;

export const POST = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.SUPORTE);

  const ticketId = params.id;
  if (!ticketId) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Ticket inválido',
      status: 400,
    });
  }

  // Admin vê mensagens internas
  const ticket = await getTicket(ticketId, true);
  if (!ticket) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Ticket não encontrado',
      status: 404,
    });
  }

  const formData = await req.formData();
  const textField = formData.get('text');
  const text = typeof textField === 'string' ? textField.trim() : '';
  if (!text) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Mensagem obrigatória',
      status: 400,
    });
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
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: `Envie no máximo ${MAX_FILES} arquivos por mensagem.`,
      status: 400,
    });
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

  return { data: message, status: 201 };
});
