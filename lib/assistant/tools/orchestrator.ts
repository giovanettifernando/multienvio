/**
 * Tool Orchestrator para o Assistente IA
 *
 * Gerencia o loop de execução de ferramentas:
 * 1. Envia mensagem para o LLM com tools disponíveis
 * 2. Se LLM retorna tool_calls, executa as ferramentas
 * 3. Envia resultados de volta ao LLM
 * 4. Repete até o LLM retornar resposta final ou atingir limite
 *
 * Limites (v2):
 * - MAX_TOOL_ITERATIONS = 4 (aumentado para consultas complexas)
 * - NO extra call when limit reached (server-side message)
 * - NO iteration reset on fallback
 * - Fallback only for 5xx/network errors, NEVER for 4xx/429
 */

import {
  chatCompletion,
  type OpenRouterMessage,
  type OpenRouterToolCall,
} from '@/lib/integrations/openrouter/client';
import { ASSISTANT_TOOLS, type AssistantToolName } from './definitions';
import { executeTool, type ToolExecutionContext, type ToolExecutionResult } from './executors';
import {
  type DebugContext,
  addDebugEvent,
  summarizeToolArgs,
  summarizeToolResult,
} from '@/lib/assistant/debug';
import { logger } from '@/lib/logger';

// ============================================================================
// Constants
// ============================================================================

const MAX_TOOL_ITERATIONS = 4;

// Server-side response when tool limit is reached (NO LLM call)
const TOOL_LIMIT_RESPONSE =
  'Não consegui concluir a consulta com segurança. ' +
  'Por favor, forneça mais detalhes como o código de rastreio ou o ID do envio.';

// ============================================================================
// Types
// ============================================================================

export interface OrchestrationResult {
  success: boolean;
  response: string;
  toolCalls: ToolCallRecord[];
  totalTokens?: number;
  error?: string;
}

export interface ToolCallRecord {
  name: string;
  args: unknown;
  result: ToolExecutionResult;
  timestamp: Date;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if an error is retryable (only 5xx or network)
 * NEVER retry 4xx or 429
 */
function isRetryableError(error: Error): boolean {
  const msg = error.message.toLowerCase();

  // 5xx errors
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return true;
  }

  // Network errors
  if (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed')
  ) {
    return true;
  }

  // NEVER retry 4xx (including 429)
  if (msg.includes('400') || msg.includes('401') || msg.includes('403') || msg.includes('404') || msg.includes('429')) {
    return false;
  }

  return false;
}

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * Orquestra a conversa com o LLM, executando ferramentas conforme necessário
 */
export async function orchestrateAssistantChat(
  messages: OpenRouterMessage[],
  ctx: ToolExecutionContext,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
  debugCtx?: DebugContext
): Promise<OrchestrationResult> {
  const toolCallRecords: ToolCallRecord[] = [];
  let currentMessages = [...messages];
  let iterations = 0;
  let totalTokens = 0;
  let useTools = true;
  let triedFallback = false;

  logger.info(
    { event: 'orchestration_start', userId: ctx.userId, messageCount: messages.length },
    'Starting assistant orchestration'
  );

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    try {
      // Chamar o LLM com ou sem tools
      const response = await chatCompletion(
        {
          messages: currentMessages,
          ...(useTools && {
            tools: ASSISTANT_TOOLS,
            tool_choice: 'auto',
          }),
          model: options?.model,
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
        },
        debugCtx
      );

      // Acumular tokens
      if (response.usage) {
        totalTokens += response.usage.total_tokens;
      }

      const choice = response.choices[0];

      // Se não há tool calls, retorna a resposta final
      if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
        logger.info(
          { event: 'orchestration_complete', iterations, totalTokens, usedTools: toolCallRecords.length > 0 },
          'Assistant orchestration complete'
        );

        return {
          success: true,
          response: choice.message.content || '',
          toolCalls: toolCallRecords,
          totalTokens,
        };
      }

      // Executar cada tool call
      const toolResults = await executeToolCalls(choice.message.tool_calls, ctx, debugCtx);
      toolCallRecords.push(...toolResults);

      // IMPORTANTE: Adicionar mensagem do assistente COM os tool_calls
      currentMessages.push({
        role: 'assistant',
        content: choice.message.content || null,
        tool_calls: choice.message.tool_calls,
      });

      // Adicionar resultados das tools como mensagens
      for (let i = 0; i < choice.message.tool_calls.length; i++) {
        const tc = choice.message.tool_calls[i];
        const result = toolResults[i];

        currentMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result.result),
        });
      }

      logger.debug(
        { event: 'tool_iteration', iteration: iterations, toolCount: choice.message.tool_calls.length },
        'Completed tool iteration'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro na orquestração';
      const errorObj = error instanceof Error ? error : new Error(errorMessage);

      logger.error(
        { event: 'orchestration_error', error: errorMessage, iteration: iterations, useTools },
        'Error during orchestration'
      );

      // Only try fallback once, and only for retryable errors (5xx/network)
      // NEVER fallback for 4xx or 429
      if (useTools && !triedFallback && isRetryableError(errorObj)) {
        logger.warn(
          { event: 'orchestration_fallback_no_tools', errorMessage },
          'Trying without tools due to 5xx/network error'
        );

        if (debugCtx) {
          addDebugEvent(debugCtx, 'error', {
            phase: 'fallback_attempt',
            reason: 'retryable_error',
            error: errorMessage.slice(0, 100),
          });
        }

        useTools = false;
        triedFallback = true;
        // DO NOT reset iterations - continue from where we are
        // DO NOT reset messages - keep the context
        continue;
      }

      // Not retryable or already tried fallback - fail
      if (debugCtx) {
        addDebugEvent(debugCtx, 'error', {
          phase: 'orchestration_failed',
          error: errorMessage.slice(0, 100),
          iterations,
          triedFallback,
        });
      }

      return {
        success: false,
        response: '',
        toolCalls: toolCallRecords,
        error: errorMessage,
      };
    }
  }

  // Atingiu limite de iterações - retornar resposta server-side SEM fazer chamada extra ao LLM
  logger.warn(
    { event: 'tool_iterations_limit_hit', iterations, toolCallsCount: toolCallRecords.length },
    'Reached maximum tool iterations - returning server-side response'
  );

  if (debugCtx) {
    addDebugEvent(debugCtx, 'tool_iterations_limit_hit', {
      iterations,
      toolCallsCount: toolCallRecords.length,
      response: 'server_side_message',
    });
  }

  return {
    success: true,
    response: TOOL_LIMIT_RESPONSE,
    toolCalls: toolCallRecords,
    totalTokens,
  };
}

/**
 * Executa uma lista de tool calls em paralelo
 */
async function executeToolCalls(
  toolCalls: OpenRouterToolCall[],
  ctx: ToolExecutionContext,
  debugCtx?: DebugContext
): Promise<ToolCallRecord[]> {
  const results: ToolCallRecord[] = [];

  const executions = toolCalls.map(async (tc) => {
    const toolName = tc.function.name as AssistantToolName;
    let args: unknown = {};

    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      logger.warn(
        { event: 'tool_args_parse_error', toolName, args: tc.function.arguments },
        'Failed to parse tool arguments'
      );
    }

    // Emit tool start event
    if (debugCtx) {
      addDebugEvent(debugCtx, 'tool_call_start', {
        toolName,
        argsSummary: summarizeToolArgs(args),
      });
    }

    const startTime = Date.now();
    const result = await executeTool(toolName, args, ctx);
    const duration = Date.now() - startTime;

    // Emit tool end event
    if (debugCtx) {
      addDebugEvent(debugCtx, 'tool_call_end', {
        toolName,
        durationMs: duration,
        success: result.success,
        resultSummary: summarizeToolResult(result),
      });
    }

    logger.debug(
      { event: 'tool_execution_complete', toolName, success: result.success, duration },
      'Tool execution complete'
    );

    return {
      name: toolName,
      args,
      result,
      timestamp: new Date(),
    };
  });

  const executed = await Promise.all(executions);
  results.push(...executed);

  return results;
}

/**
 * Versão simplificada para chat sem tools (perguntas diretas)
 */
export async function simpleAssistantChat(
  messages: OpenRouterMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
  debugCtx?: DebugContext
): Promise<{ success: boolean; response: string; error?: string }> {
  try {
    const response = await chatCompletion(
      {
        messages,
        model: options?.model,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      },
      debugCtx
    );

    return {
      success: true,
      response: response.choices[0].message.content || '',
    };
  } catch (error) {
    return {
      success: false,
      response: '',
      error: error instanceof Error ? error.message : 'Erro ao processar mensagem',
    };
  }
}
