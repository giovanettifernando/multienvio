/**
 * GET /api/assistant/sessions/[id]
 *
 * Retorna detalhes de uma sessão de chat específica com todas as mensagens.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';

// ============================================================================
// Types
// ============================================================================

interface MessageItem {
  id: string;
  author: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  createdAt: string;
}

interface SessionDetailResponse {
  id: string;
  title: string;
  messages: MessageItem[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// GET - Detalhes da sessão com mensagens
// ============================================================================

export const GET = withApiHandler<SessionDetailResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const sessionId = context.params.id;

  // Buscar sessão com mensagens
  const chatSession = await prisma.assistantChatSession.findFirst({
    where: {
      id: sessionId,
      userId: session.userId, // RBAC: só acessa próprias sessões
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!chatSession) {
    throw new ApiError({ code: 'not_found', message: 'Sessão não encontrada', status: 404 });
  }

  const messages: MessageItem[] = chatSession.messages.map((m) => ({
    id: m.id,
    author: m.author === 'USER' ? 'user' : m.author === 'ASSISTANT' ? 'assistant' : 'tool',
    content: m.content,
    ...(m.toolName && { toolName: m.toolName }),
    ...(m.toolArgs && { toolArgs: m.toolArgs }),
    ...(m.toolResult && { toolResult: m.toolResult }),
    createdAt: m.createdAt.toISOString(),
  }));

  return {
    data: {
      id: chatSession.id,
      title: chatSession.title || 'Conversa sem título',
      messages,
      createdAt: chatSession.createdAt.toISOString(),
      updatedAt: chatSession.updatedAt.toISOString(),
    },
  };
});
