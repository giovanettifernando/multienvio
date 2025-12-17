/**
 * Tool Orchestrator para o Assistente IA
 *
 * Gerencia o loop de execução de ferramentas:
 * 1. Envia mensagem para o LLM com tools disponíveis
 * 2. Se LLM retorna tool_calls, executa as ferramentas
 * 3. Envia resultados de volta ao LLM
 * 4. Repete até o LLM retornar resposta final ou atingir limite
 *
 * Limite de iterações: 3 (para evitar loops infinitos)
 */

import {
  chatCompletion,
  type OpenRouterMessage,
  type OpenRouterToolCall,
  type OpenRouterChatResponse,
} from '@/lib/integrations/openrouter/client';
import { ASSISTANT_TOOLS, type AssistantToolName } from './definitions';
import { executeTool, type ToolExecutionContext, type ToolExecutionResult } from './executors';
import { logger } from '@/lib/logger';

// ============================================================================
// Constants
// ============================================================================

const MAX_TOOL_ITERATIONS = 3;

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
  }
): Promise<OrchestrationResult> {
  const toolCallRecords: ToolCallRecord[] = [];
  let currentMessages = [...messages];
  let iterations = 0;
  let totalTokens = 0;
  let useTools = true; // Flag to track if we should use tools

  logger.info(
    { event: 'orchestration_start', userId: ctx.userId, messageCount: messages.length },
    'Starting assistant orchestration'
  );

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    try {
      // Chamar o LLM com ou sem tools
      const response = await chatCompletion({
        messages: currentMessages,
        ...(useTools && {
          tools: ASSISTANT_TOOLS,
          tool_choice: 'auto',
        }),
        model: options?.model,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      });

      // Acumular tokens
      if (response.usage) {
        totalTokens += response.usage.total_tokens;
      }

      const choice = response.choices[0];

      // Se não há tool calls, retorna a resposta final
      if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
        logger.info(
          { event: 'orchestration_complete', iterations, totalTokens },
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
      const toolResults = await executeToolCalls(choice.message.tool_calls, ctx);
      toolCallRecords.push(...toolResults);

      // IMPORTANTE: Adicionar mensagem do assistente COM os tool_calls
      // OpenRouter/OpenAI API requer que a mensagem do assistant inclua os tool_calls que ele fez
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

      logger.error(
        { event: 'orchestration_error', error: errorMessage, iteration: iterations, useTools },
        'Error during orchestration'
      );

      // Detectar erros que indicam problema com tools ou disponibilidade
      const isToolRelatedError =
        errorMessage.includes('tool') ||
        errorMessage.includes('404') ||
        errorMessage.includes('No endpoints') ||
        errorMessage.includes('503') ||
        errorMessage.includes('429') ||
        errorMessage.includes('rate limit');

      // Se falhou com tools e é um erro relacionado a tools/disponibilidade, tentar sem tools
      if (useTools && iterations <= 2 && isToolRelatedError) {
        logger.warn(
          { event: 'orchestration_fallback_no_tools', errorMessage },
          'Retrying without tools due to tool-related error'
        );
        useTools = false;
        // Reset messages to original (sem tool calls anteriores)
        currentMessages = [...messages];
        iterations = 0;
        continue;
      }

      return {
        success: false,
        response: '',
        toolCalls: toolCallRecords,
        error: errorMessage,
      };
    }
  }

  // Atingiu limite de iterações - fazer uma última chamada sem tools
  logger.warn(
    { event: 'orchestration_limit_reached', iterations },
    'Reached maximum tool iterations'
  );

  try {
    const finalResponse = await chatCompletion({
      messages: [
        ...currentMessages,
        {
          role: 'system',
          content: 'Você atingiu o limite de chamadas de ferramentas. Por favor, forneça uma resposta final ao usuário com base nas informações já coletadas.',
        },
      ],
      model: options?.model,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    if (finalResponse.usage) {
      totalTokens += finalResponse.usage.total_tokens;
    }

    return {
      success: true,
      response: finalResponse.choices[0].message.content || 'Desculpe, não consegui processar sua solicitação completamente.',
      toolCalls: toolCallRecords,
      totalTokens,
    };
  } catch (error) {
    return {
      success: false,
      response: '',
      toolCalls: toolCallRecords,
      error: 'Erro ao gerar resposta final',
    };
  }
}

/**
 * Executa uma lista de tool calls em paralelo
 */
async function executeToolCalls(
  toolCalls: OpenRouterToolCall[],
  ctx: ToolExecutionContext
): Promise<ToolCallRecord[]> {
  const results: ToolCallRecord[] = [];

  // Executar tools em paralelo para melhor performance
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

    logger.debug(
      { event: 'tool_execution_start', toolName, args },
      'Starting tool execution'
    );

    const startTime = Date.now();
    const result = await executeTool(toolName, args, ctx);
    const duration = Date.now() - startTime;

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
  }
): Promise<{ success: boolean; response: string; error?: string }> {
  try {
    const response = await chatCompletion({
      messages,
      model: options?.model,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

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
