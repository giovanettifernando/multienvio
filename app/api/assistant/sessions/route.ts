/**
 * GET /api/assistant/sessions
 * DELETE /api/assistant/sessions
 *
 * Lista e gerencia sessões de chat do assistente.
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

// ============================================================================
// Types
// ============================================================================

interface SessionListItem {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

interface SessionListResponse {
  sessions: SessionListItem[];
  total: number;
}

interface DeleteSessionsResponse {
  deleted: number;
}

// ============================================================================
// GET - Lista sessões do usuário
// ============================================================================

export const GET = withApiHandler<SessionListResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const url = new URL(context.req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Buscar sessões com contagem de mensagens
  const sessions = await prisma.assistantChatSession.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      _count: {
        select: { messages: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const total = await prisma.assistantChatSession.count({
    where: { userId: session.userId },
  });

  const items: SessionListItem[] = sessions.map((s) => ({
    id: s.id,
    title: s.title || 'Conversa sem título',
    messageCount: s._count.messages,
    lastMessageAt: s.messages[0]?.createdAt.toISOString() || null,
    createdAt: s.createdAt.toISOString(),
  }));

  return {
    data: {
      sessions: items,
      total,
    },
  };
});

// ============================================================================
// DELETE - Remove sessões antigas ou específicas
// ============================================================================

export const DELETE = withApiHandler<DeleteSessionsResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const url = new URL(context.req.url);
  const sessionId = url.searchParams.get('id');
  const olderThanDays = parseInt(url.searchParams.get('olderThanDays') || '0');

  if (sessionId) {
    // Deletar sessão específica
    const existing = await prisma.assistantChatSession.findFirst({
      where: { id: sessionId, userId: session.userId },
    });

    if (!existing) {
      throw new ApiError({ code: 'not_found', message: 'Sessão não encontrada', status: 404 });
    }

    // Deletar mensagens primeiro (cascade)
    await prisma.assistantChatMessage.deleteMany({
      where: { sessionId },
    });

    await prisma.assistantChatSession.delete({
      where: { id: sessionId },
    });

    return { data: { deleted: 1 } };
  }

  if (olderThanDays > 0) {
    // Deletar sessões mais antigas que X dias
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Buscar IDs das sessões a deletar
    const sessionsToDelete = await prisma.assistantChatSession.findMany({
      where: {
        userId: session.userId,
        updatedAt: { lt: cutoffDate },
      },
      select: { id: true },
    });

    const sessionIds = sessionsToDelete.map((s) => s.id);

    if (sessionIds.length > 0) {
      // Deletar mensagens
      await prisma.assistantChatMessage.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });

      // Deletar sessões
      await prisma.assistantChatSession.deleteMany({
        where: { id: { in: sessionIds } },
      });
    }

    return { data: { deleted: sessionIds.length } };
  }

  throw new ApiError({
    code: 'bad_request',
    message: 'Especifique id ou olderThanDays',
    status: 400,
  });
});
