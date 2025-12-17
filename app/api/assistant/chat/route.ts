/**
 * POST /api/assistant/chat
 *
 * API principal do Assistente IA.
 * Recebe mensagens do usuário, processa com LLM e retorna resposta.
 *
 * Features:
 * - Orquestração de ferramentas (listar envios, saldo, tickets, etc.)
 * - Persistência de sessões e mensagens
 * - Idempotência por requestId (60s TTL)
 * - Debug trace (quando x-assistant-debug: 1)
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
import {
  createDebugContext,
  addDebugEvent,
  generateDebugSummary,
  type DebugContext,
  type DebugSummary,
  type DebugEvent,
} from '@/lib/assistant/debug';
import { logger } from '@/lib/logger';

// ============================================================================
// Idempotency Cache (in-memory, 60s TTL)
// ============================================================================

interface CachedResponse {
  data: ChatResponse;
  debugSummary?: DebugSummary;
  timestamp: number;
}

const idempotencyCache = new Map<string, CachedResponse>();
const IDEMPOTENCY_TTL_MS = 60_000; // 60 seconds

// Cleanup expired entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}, 30_000);

// Track in-progress requests to prevent duplicate processing
const inProgressRequests = new Set<string>();

// ============================================================================
// Validation Schema
// ============================================================================

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Mensagem é obrigatória').max(10000, 'Mensagem muito longa'),
  sessionId: z.string().optional(),
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

interface ChatResponseWithDebug extends ChatResponse {
  debugSummary?: DebugSummary;
  debugEvents?: DebugEvent[];
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
    const existing = await prisma.assistantChatSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (existing) {
      return { id: existing.id, isNew: false };
    }
  }

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
  await prisma.assistantChatMessage.create({
    data: {
      sessionId,
      author: 'USER',
      content: userMessage,
    },
  });

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

  const assistantMsg = await prisma.assistantChatMessage.create({
    data: {
      sessionId,
      author: 'ASSISTANT',
      content: assistantResponse,
    },
  });

  const messageCount = await prisma.assistantChatMessage.count({
    where: { sessionId },
  });

  if (messageCount <= 3) {
    const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');
    await prisma.assistantChatSession.update({
      where: { id: sessionId },
      data: { title },
    });
  }

  return assistantMsg.id;
}

/**
 * Sanitize error message for user (hide technical details)
 */
function sanitizeErrorForUser(error: string): string {
  // Check for rate limit (429)
  if (error.includes('429') || error.toLowerCase().includes('rate limit')) {
    return 'Desculpe, o assistente está temporariamente indisponível. Tente novamente em alguns instantes.';
  }

  // Check for other API errors
  if (error.includes('OpenRouter') || error.includes('API')) {
    return 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
  }

  // Generic error
  return 'Desculpe, ocorreu um erro inesperado. Tente novamente.';
}

// ============================================================================
// API Handler
// ============================================================================

export const POST = withApiHandler<ChatResponseWithDebug>(async (context) => {
  const startTime = Date.now();

  // Get request ID from header (for idempotency and debug)
  const requestId = context.req.headers.get('x-assistant-request-id') || crypto.randomUUID();
  const debugEnabled = context.req.headers.get('x-assistant-debug') === '1';

  // Create debug context
  const debugCtx: DebugContext | undefined = debugEnabled
    ? createDebugContext(requestId, true)
    : undefined;

  if (debugCtx) {
    addDebugEvent(debugCtx, 'request_start', { requestId });
  }

  // Check idempotency cache
  const cached = idempotencyCache.get(requestId);
  if (cached) {
    logger.info({ event: 'idempotency_hit', requestId }, 'Returning cached response');

    if (debugCtx) {
      addDebugEvent(debugCtx, 'idempotency_hit', { requestId, age: Date.now() - cached.timestamp });
    }

    return {
      data: {
        ...cached.data,
        ...(debugEnabled && {
          debugSummary: cached.debugSummary,
          debugEvents: debugCtx?.events,
        }),
      },
    };
  }

  // Check if request is already in progress
  if (inProgressRequests.has(requestId)) {
    throw new ApiError({
      code: 'REQUEST_IN_PROGRESS',
      message: 'Esta requisição já está sendo processada',
      status: 409,
    });
  }

  // Mark request as in progress
  inProgressRequests.add(requestId);

  try {
    // Verificar se OpenRouter está configurado
    const configured = await isOpenRouterConfigured();
    if (!configured) {
      throw new ApiError({
        code: 'NOT_CONFIGURED',
        message: 'Assistente não disponível. Entre em contato com o suporte.',
        status: 503,
      });
    }

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
      logger.info({ event: 'assistant_chat_unauthenticated', requestId }, 'Unauthenticated assistant chat');

      const messages: OpenRouterMessage[] = [
        { role: 'system', content: UNAUTHENTICATED_PROMPT },
        { role: 'user', content: message },
      ];

      const result = await orchestrateAssistantChat(
        messages,
        { userId: 'anonymous' },
        {
          model: config.defaultModel,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
        debugCtx
      );

      if (!result.success) {
        const userMessage = sanitizeErrorForUser(result.error || '');

        if (debugCtx) {
          addDebugEvent(debugCtx, 'error', {
            phase: 'orchestration',
            originalError: result.error?.slice(0, 100),
            sanitizedMessage: userMessage,
          });
        }

        throw new ApiError({
          code: 'ASSISTANT_ERROR',
          message: userMessage,
          status: 500,
        });
      }

      const responseData: ChatResponse = {
        response: result.response,
        sessionId: '',
        messageId: '',
        toolsUsed: result.toolCalls.map((tc) => tc.name),
      };

      const debugSummary = debugCtx
        ? generateDebugSummary(debugCtx, startTime, true)
        : undefined;

      if (debugCtx) {
        addDebugEvent(debugCtx, 'request_end', {
          success: true,
          durationMs: Date.now() - startTime,
        });
      }

      // Cache the response
      idempotencyCache.set(requestId, {
        data: responseData,
        debugSummary,
        timestamp: Date.now(),
      });

      return {
        data: {
          ...responseData,
          ...(debugEnabled && {
            debugSummary,
            debugEvents: debugCtx?.events,
          }),
        },
      };
    }

    // Modo autenticado
    const userId = session.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const chatSession = await getOrCreateSession(userId, sessionId);

    logger.info(
      { event: 'assistant_chat_start', userId, requestId, sessionId: chatSession.id, isNewSession: chatSession.isNew },
      'Starting assistant chat'
    );

    // Montar mensagens
    const messages: OpenRouterMessage[] = [];

    messages.push({
      role: 'system',
      content: generateSystemPrompt({
        userName: user?.name,
        userEmail: user?.email,
        isAuthenticated: true,
      }),
    });

    if (includeHistory && !chatSession.isNew) {
      const history = await loadSessionHistory(chatSession.id);
      messages.push(...history);
    }

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
      },
      debugCtx
    );

    if (!result.success) {
      const userMessage = sanitizeErrorForUser(result.error || '');

      logger.error(
        { event: 'assistant_chat_error', error: result.error, requestId, sessionId: chatSession.id },
        'Assistant chat failed'
      );

      if (debugCtx) {
        addDebugEvent(debugCtx, 'error', {
          phase: 'orchestration',
          originalError: result.error?.slice(0, 100),
          sanitizedMessage: userMessage,
        });
      }

      throw new ApiError({
        code: 'ASSISTANT_ERROR',
        message: userMessage,
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
      { event: 'assistant_chat_complete', requestId, sessionId: chatSession.id, toolsUsed: result.toolCalls.length },
      'Assistant chat complete'
    );

    const responseData: ChatResponse = {
      response: result.response,
      sessionId: chatSession.id,
      messageId,
      toolsUsed: result.toolCalls.map((tc) => tc.name),
    };

    const debugSummary = debugCtx
      ? generateDebugSummary(debugCtx, startTime, true)
      : undefined;

    if (debugCtx) {
      addDebugEvent(debugCtx, 'request_end', {
        success: true,
        durationMs: Date.now() - startTime,
        toolsUsed: result.toolCalls.length,
      });
    }

    // Cache the response
    idempotencyCache.set(requestId, {
      data: responseData,
      debugSummary,
      timestamp: Date.now(),
    });

    return {
      data: {
        ...responseData,
        ...(debugEnabled && {
          debugSummary,
          debugEvents: debugCtx?.events,
        }),
      },
    };
  } finally {
    // Remove from in-progress set
    inProgressRequests.delete(requestId);
  }
});
