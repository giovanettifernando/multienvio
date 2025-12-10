import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { addMessageToTicket, getTicket } from '@/lib/support/service';
import { persistSupportAttachments } from '@/lib/storage/support-attachments';


const MAX_FILES = 5;

export const POST = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  if (!session.permissions.includes(AdminPermission.SUPORTE) && !session.isSuperAdmin) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para acessar este recurso',
      status: 403,
    });
  }

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
