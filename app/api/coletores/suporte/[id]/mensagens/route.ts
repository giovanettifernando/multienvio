import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import {
  addMessageToTicketForAutonomousCollector,
  getTicketForAutonomousCollector,
} from '@/lib/support/autonomous-collector-service';
import { type SupportMessage } from '@/lib/validation/support';
import { z } from 'zod';

const AddMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem não pode estar vazia'),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        url: z.string(),
        size: z.number(),
      })
    )
    .optional(),
});

type AddMessageResponse = {
  message: SupportMessage;
};

/**
 * POST /api/coletores/suporte/[id]/mensagens
 * Adiciona mensagem a um ticket do coletor autônomo
 */
export const POST = withApiHandler<AddMessageResponse, { id: string }>(async (context) => {
  const { req, params, logger } = context;

  const session = await getAutonomousCollectorSession();
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { id } = params;

  // Verificar se o ticket existe e pertence ao coletor
  const ticket = await getTicketForAutonomousCollector(id, session.coletorId);
  if (!ticket) {
    throw new ApiError({ code: 'not_found', message: 'Ticket não encontrado', status: 404 });
  }

  const body = await req.json();

  try {
    const validatedData = AddMessageSchema.parse(body);

    const message = await addMessageToTicketForAutonomousCollector(
      id,
      session.coletorId,
      validatedData.content,
      validatedData.attachments
    );

    logger.info('coletores_suporte_add_message', { coletorId: session.coletorId, ticketId: id });

    return { data: { message }, status: 201 };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError({
        code: 'validation_error',
        message: 'Dados inválidos',
        status: 400,
        details: { errors: error.issues },
      });
    }
    throw error;
  }
});
