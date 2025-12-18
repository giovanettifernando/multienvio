import { getSession } from "@/modules/auth/application/session";
import { getTicketForUser } from "@/modules/support/application/service";
import { withApiHandler } from "@/platform/api/handler";
import { ApiError } from "@/platform/api/errors";
import type { SupportAttachment } from '@/shared/validation/support';

interface GetAttachmentsResponse {
  attachments: SupportAttachment[];
}

interface PostAttachmentsResponse {
  message: string;
}

export const GET = withApiHandler<GetAttachmentsResponse, { id: string }>(async ({ params }) => {
  const session = await getSession();
  if (!session) {
    throw new ApiError({ code: "UNAUTHORIZED", message: "Não autenticado", status: 401 });
  }

  const { id: ticketId } = params;
  if (!ticketId) {
    throw new ApiError({ code: "VALIDATION_ERROR", message: "Ticket inválido", status: 400 });
  }

  const ticket = await getTicketForUser(session.userId, ticketId);
  if (!ticket) {
    throw new ApiError({ code: "NOT_FOUND", message: "Ticket não encontrado", status: 404 });
  }

  return { data: { attachments: ticket.attachments ?? [] } };
});

export const POST = withApiHandler<PostAttachmentsResponse>(async () => {
  throw new ApiError({
    code: "NOT_IMPLEMENTED",
    message: "Upload de anexos não implementado.",
    status: 501,
  });
});
