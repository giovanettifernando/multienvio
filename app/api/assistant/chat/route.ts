/**
 * POST /api/assistant/chat
 *
 * API principal do Assistente IA.
 * Recebe mensagens do usuário, processa com LLM e retorna resposta.
 *
 * Features:
 * - Orquestração de ferramentas (listar envios, saldo, tickets, etc.)
 * - Persistência de sessões e mensagens
 * - Streaming de respostas (opcional)
 * - RBAC: usuário só acessa seus próprios dados
 */

import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { isOpenRouterConfigured, getOpenRouterConfigDecrypted } from '@/lib/integrations/openrouter/config.service';
import { orchestrateAssistantChat } from '@/lib/assistant/tools/orchestrator';
import { generateSystemPrompt, UNAUTHENTICATED_PROMPT } from '@/lib/assistant/prompts/system';
import type { OpenRouterMessage } from '@/lib/integrations/openrouter/client';
import { logger } from '@/lib/logger';

// ============================================================================
// Validation Schema
// ============================================================================

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Mensagem é obrigatória').max(10000, 'Mensagem muito longa'),
  sessionId: z.string().optional(),
  // Se true, carrega histórico da sessão
  includeHistory: z.boolean().optional().default(true),
});

// ============================================================================
// Types
// ============================================================================

interface ChatResponse {
  response: string;
  sessionId: string;
  messageId: string;
  toolsUsed: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Carrega ou cria uma sessão de chat
 */
async function getOrCreateSession(
  userId: string,
  sessionId?: string
): Promise<{ id: string; isNew: boolean }> {
  if (sessionId) {
    // Verificar se sessão existe e pertence ao usuário
    const existing = await prisma.assistantChatSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (existing) {
      return { id: existing.id, isNew: false };
    }
  }

  // Criar nova sessão
  const session = await prisma.assistantChatSession.create({
    data: {
      userId,
      title: 'Nova conversa',
    },
  });

  return { id: session.id, isNew: true };
}

/**
 * Carrega histórico de mensagens da sessão
 */
async function loadSessionHistory(
  sessionId: string,
  limit: number = 20
): Promise<OpenRouterMessage[]> {
  const messages = await prisma.assistantChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  return messages.map((m) => ({
    role: m.author === 'USER' ? 'user' : m.author === 'ASSISTANT' ? 'assistant' : 'tool',
    content: m.content,
    ...(m.toolName && { name: m.toolName }),
  })) as OpenRouterMessage[];
}

/**
 * Salva mensagens na sessão
 */
async function saveMessages(
  sessionId: string,
  userMessage: string,
  assistantResponse: string,
  toolCalls: Array<{ name: string; args: unknown; result: unknown }>
): Promise<string> {
  // Salvar mensagem do usuário
  await prisma.assistantChatMessage.create({
    data: {
      sessionId,
      author: 'USER',
      content: userMessage,
    },
  });

  // Salvar tool calls (se houver)
  for (const tc of toolCalls) {
    await prisma.assistantChatMessage.create({
      data: {
        sessionId,
        author: 'TOOL',
        content: JSON.stringify(tc.result),
        toolName: tc.name,
        toolArgs: tc.args as object,
        toolResult: tc.result as object,
      },
    });
  }

  // Salvar resposta do assistente
  const assistantMsg = await prisma.assistantChatMessage.create({
    data: {
      sessionId,
      author: 'ASSISTANT',
      content: assistantResponse,
    },
  });

  // Atualizar título da sessão se for a primeira mensagem
  const messageCount = await prisma.assistantChatMessage.count({
    where: { sessionId },
  });

  if (messageCount <= 3) {
    // Usar primeiras palavras da primeira mensagem como título
    const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');
    await prisma.assistantChatSession.update({
      where: { id: sessionId },
      data: { title },
    });
  }

  return assistantMsg.id;
}

// ============================================================================
// API Handler
// ============================================================================

export const POST = withApiHandler<ChatResponse>(async (context) => {
  // Verificar se OpenRouter está configurado
  const configured = await isOpenRouterConfigured();
  if (!configured) {
    throw new ApiError({
      code: 'NOT_CONFIGURED',
      message: 'Assistente não disponível. Entre em contato com o suporte.',
      status: 503,
    });
  }

  // Buscar configuração
  const config = await getOpenRouterConfigDecrypted();
  if (!config) {
    throw new ApiError({
      code: 'NOT_CONFIGURED',
      message: 'Configuração do assistente não encontrada',
      status: 503,
    });
  }

  // Validar request
  const body = await context.req.json();
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { message, sessionId, includeHistory } = parsed.data;

  // Verificar autenticação
  const session = await getUserFromRequest(context.req);
  const isAuthenticated = !!session?.userId;

  // Se não autenticado, usar modo limitado
  if (!isAuthenticated) {
    // Modo limitado: sem persistência, sem acesso a dados
    logger.info({ event: 'assistant_chat_unauthenticated' }, 'Unauthenticated assistant chat');

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: UNAUTHENTICATED_PROMPT },
      { role: 'user', content: message },
    ];

    const result = await orchestrateAssistantChat(messages, {
      userId: 'anonymous',
    }, {
      model: config.defaultModel,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    if (!result.success) {
      throw new ApiError({
        code: 'ASSISTANT_ERROR',
        message: result.error || 'Erro ao processar mensagem',
        status: 500,
      });
    }

    return {
      data: {
        response: result.response,
        sessionId: '',
        messageId: '',
        toolsUsed: result.toolCalls.map((tc) => tc.name),
      },
    };
  }

  // Modo autenticado: com persistência e acesso completo
  const userId = session.userId;

  // Buscar dados do usuário para contexto
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  // Criar ou recuperar sessão
  const chatSession = await getOrCreateSession(userId, sessionId);

  logger.info(
    { event: 'assistant_chat_start', userId, sessionId: chatSession.id, isNewSession: chatSession.isNew },
    'Starting assistant chat'
  );

  // Montar mensagens
  const messages: OpenRouterMessage[] = [];

  // System prompt com contexto do usuário
  messages.push({
    role: 'system',
    content: generateSystemPrompt({
      userName: user?.name,
      userEmail: user?.email,
      isAuthenticated: true,
    }),
  });

  // Carregar histórico se solicitado
  if (includeHistory && !chatSession.isNew) {
    const history = await loadSessionHistory(chatSession.id);
    messages.push(...history);
  }

  // Adicionar mensagem atual
  messages.push({ role: 'user', content: message });

  // Executar orquestração
  const result = await orchestrateAssistantChat(
    messages,
    {
      userId,
      userName: user?.name,
      userEmail: user?.email,
    },
    {
      model: config.defaultModel,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    }
  );

  if (!result.success) {
    logger.error(
      { event: 'assistant_chat_error', error: result.error, sessionId: chatSession.id },
      'Assistant chat failed'
    );

    throw new ApiError({
      code: 'ASSISTANT_ERROR',
      message: result.error || 'Erro ao processar mensagem',
      status: 500,
    });
  }

  // Persistir mensagens
  const messageId = await saveMessages(
    chatSession.id,
    message,
    result.response,
    result.toolCalls.map((tc) => ({
      name: tc.name,
      args: tc.args,
      result: tc.result,
    }))
  );

  logger.info(
    { event: 'assistant_chat_complete', sessionId: chatSession.id, toolsUsed: result.toolCalls.length },
    'Assistant chat complete'
  );

  return {
    data: {
      response: result.response,
      sessionId: chatSession.id,
      messageId,
      toolsUsed: result.toolCalls.map((tc) => tc.name),
    },
  };
});
