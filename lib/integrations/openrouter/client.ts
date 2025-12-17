/**
 * OpenRouter API Client
 *
 * Cliente para chamadas à API do OpenRouter.
 * Suporta chat completions, streaming e listagem de modelos.
 *
 * Retry Policy (v2):
 * - maxRetries = 2 for :free models, 1 for paid
 * - NEVER retry on 429 (rate limit) or any 4xx
 * - Only retry on network errors or 5xx
 * - Backoff: 250ms, 750ms
 *
 * @see https://openrouter.ai/docs
 */

import { getOpenRouterConfigDecrypted } from './config.service';
import {
  type DebugContext,
  addDebugEvent,
  nextCallIndex,
} from '@/lib/assistant/debug';

// ============================================================================
// Types
// ============================================================================

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenRouterToolCall[];
};

export type OpenRouterTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OpenRouterToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type OpenRouterChatRequest = {
  model?: string;
  messages: OpenRouterMessage[];
  tools?: OpenRouterTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  route?: 'fallback';
  transforms?: string[];
  provider?: {
    order?: string[];
    require_parameters?: boolean;
    allow_fallbacks?: boolean;
  };
};

export type OpenRouterChatChoice = {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenRouterToolCall[];
  };
  finish_reason: 'stop' | 'tool_calls' | 'length' | null;
};

export type OpenRouterChatResponse = {
  id: string;
  model: string;
  choices: OpenRouterChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
  top_provider?: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
};

export type OpenRouterModelsResponse = {
  data: OpenRouterModel[];
};

export type OpenRouterKeyInfo = {
  data: {
    label?: string;
    usage: number;
    limit: number | null;
    is_free_tier: boolean;
    rate_limit: {
      requests: number;
      interval: string;
    };
  };
};

export type OpenRouterStreamChunk = {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'tool_calls' | 'length' | null;
  }>;
};

// ============================================================================
// Constants
// ============================================================================

const BACKOFF_MS = [250, 750]; // Backoff delays for retries

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if an HTTP status code is retryable
 * NEVER retry 429 or any 4xx - only 5xx
 */
function isRetryableStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

/**
 * Check if an error is a network error (no HTTP status)
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('fetch failed')
    );
  }
  return false;
}

// ============================================================================
// Client
// ============================================================================

async function getHeaders(): Promise<HeadersInit> {
  const config = await getOpenRouterConfigDecrypted();

  if (!config) {
    throw new Error('OpenRouter não configurado');
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };

  if (config.httpReferer) {
    headers['HTTP-Referer'] = config.httpReferer;
  }

  if (config.xTitle) {
    headers['X-Title'] = config.xTitle;
  }

  return headers;
}

async function getBaseUrl(): Promise<string> {
  const config = await getOpenRouterConfigDecrypted();
  return config?.baseUrl ?? 'https://openrouter.ai/api/v1';
}

/**
 * Testa a conexão com o OpenRouter verificando a API key
 */
export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  data?: OpenRouterKeyInfo['data'];
}> {
  try {
    const headers = await getHeaders();
    const baseUrl = await getBaseUrl();

    const response = await fetch(`${baseUrl}/key`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        message: `Erro ${response.status}: ${error}`,
      };
    }

    const data = (await response.json()) as OpenRouterKeyInfo;

    return {
      success: true,
      message: 'Conexão bem-sucedida',
      data: data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Lista modelos disponíveis no OpenRouter
 */
export async function listModels(): Promise<OpenRouterModel[]> {
  const headers = await getHeaders();
  const baseUrl = await getBaseUrl();

  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Erro ao listar modelos: ${response.status}`);
  }

  const data = (await response.json()) as OpenRouterModelsResponse;
  return data.data;
}

/**
 * Envia mensagem para chat completion (sem streaming)
 *
 * @param request - Request parameters
 * @param debugCtx - Optional debug context for tracing
 */
export async function chatCompletion(
  request: OpenRouterChatRequest,
  debugCtx?: DebugContext
): Promise<OpenRouterChatResponse> {
  const config = await getOpenRouterConfigDecrypted();

  if (!config) {
    throw new Error('OpenRouter não configurado');
  }

  const headers = await getHeaders();
  const baseUrl = await getBaseUrl();

  const body: OpenRouterChatRequest = {
    ...request,
    model: request.model ?? config.defaultModel,
    temperature: request.temperature ?? config.temperature,
    max_tokens: request.max_tokens ?? config.maxTokens,
    stream: false,
  };

  // Add routing configuration for tool use
  if (request.tools && request.tools.length > 0) {
    const isFreeModel = body.model?.includes(':free');

    if (isFreeModel) {
      body.provider = {
        require_parameters: true,
        allow_fallbacks: true,
      };
    } else {
      const modelProvider = body.model?.split('/')[0];
      const providerName = modelProvider
        ? modelProvider.charAt(0).toUpperCase() + modelProvider.slice(1)
        : 'Anthropic';

      body.provider = {
        order: [providerName],
        require_parameters: true,
        allow_fallbacks: true,
      };
    }
  }

  const isFreeModel = body.model?.includes(':free');
  const maxRetries = isFreeModel ? 2 : 1;
  let lastError: Error | null = null;
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const callIndex = debugCtx ? nextCallIndex(debugCtx) : attempt;
    const startTime = Date.now();

    // Emit call start event
    if (debugCtx) {
      addDebugEvent(debugCtx, 'openrouter_call_start', {
        callIndex,
        attempt,
        maxRetries,
        model: body.model,
        toolsCount: body.tools?.length ?? 0,
        reason: attempt === 1 ? 'initial' : 'retry',
      });
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        lastStatus = response.status;
        lastError = new Error(`Erro OpenRouter: ${response.status} - ${errorText}`);

        // Emit call end event (error)
        if (debugCtx) {
          addDebugEvent(debugCtx, 'openrouter_call_end', {
            callIndex,
            status: response.status,
            durationMs,
            success: false,
            error: `${response.status}`,
          });
        }

        // Check if retryable (only 5xx, NEVER 429 or 4xx)
        if (attempt < maxRetries && isRetryableStatus(response.status)) {
          const backoffMs = BACKOFF_MS[attempt - 1] ?? 750;

          if (debugCtx) {
            addDebugEvent(debugCtx, 'openrouter_retry', {
              callIndex,
              attempt,
              status: response.status,
              backoffMs,
              reason: '5xx_error',
            });
          }

          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        // Not retryable - throw immediately
        throw lastError;
      }

      const result = (await response.json()) as OpenRouterChatResponse;

      // Emit call end event (success)
      if (debugCtx) {
        addDebugEvent(debugCtx, 'openrouter_call_end', {
          callIndex,
          status: 200,
          durationMs,
          success: true,
          tokens: result.usage?.total_tokens,
        });
      }

      return result;
    } catch (fetchError) {
      const durationMs = Date.now() - startTime;
      lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));

      // Check if it's a network error (retryable)
      if (attempt < maxRetries && isNetworkError(fetchError)) {
        const backoffMs = BACKOFF_MS[attempt - 1] ?? 750;

        if (debugCtx) {
          addDebugEvent(debugCtx, 'openrouter_retry', {
            callIndex,
            attempt,
            backoffMs,
            reason: 'network_error',
            error: lastError.message.slice(0, 100),
          });
        }

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      // Emit error event
      if (debugCtx) {
        addDebugEvent(debugCtx, 'openrouter_error', {
          callIndex,
          durationMs,
          status: lastStatus,
          error: lastError.message.slice(0, 200),
          isRateLimit: lastStatus === 429,
        });
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Erro desconhecido no OpenRouter');
}

/**
 * Envia mensagem para chat completion com streaming
 * Retorna um ReadableStream que pode ser consumido pelo frontend
 */
export async function chatCompletionStream(
  request: OpenRouterChatRequest,
  debugCtx?: DebugContext
): Promise<ReadableStream<Uint8Array>> {
  const config = await getOpenRouterConfigDecrypted();

  if (!config) {
    throw new Error('OpenRouter não configurado');
  }

  const headers = await getHeaders();
  const baseUrl = await getBaseUrl();

  const body: OpenRouterChatRequest = {
    ...request,
    model: request.model ?? config.defaultModel,
    temperature: request.temperature ?? config.temperature,
    max_tokens: request.max_tokens ?? config.maxTokens,
    stream: true,
  };

  // Add routing configuration for tool use
  if (request.tools && request.tools.length > 0) {
    const isFreeModel = body.model?.includes(':free');

    if (isFreeModel) {
      body.provider = {
        require_parameters: true,
        allow_fallbacks: true,
      };
    } else {
      const modelProvider = body.model?.split('/')[0];
      const providerName = modelProvider
        ? modelProvider.charAt(0).toUpperCase() + modelProvider.slice(1)
        : 'Anthropic';

      body.provider = {
        order: [providerName],
        require_parameters: true,
        allow_fallbacks: true,
      };
    }
  }

  const isFreeModel = body.model?.includes(':free');
  const maxRetries = isFreeModel ? 2 : 1;
  let lastError: Error | null = null;
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const callIndex = debugCtx ? nextCallIndex(debugCtx) : attempt;
    const startTime = Date.now();

    if (debugCtx) {
      addDebugEvent(debugCtx, 'openrouter_call_start', {
        callIndex,
        attempt,
        maxRetries,
        model: body.model,
        toolsCount: body.tools?.length ?? 0,
        reason: attempt === 1 ? 'initial' : 'retry',
        stream: true,
      });
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        lastStatus = response.status;
        lastError = new Error(`Erro OpenRouter: ${response.status} - ${errorText}`);

        if (debugCtx) {
          addDebugEvent(debugCtx, 'openrouter_call_end', {
            callIndex,
            status: response.status,
            durationMs,
            success: false,
            error: `${response.status}`,
            stream: true,
          });
        }

        // Check if retryable (only 5xx, NEVER 429 or 4xx)
        if (attempt < maxRetries && isRetryableStatus(response.status)) {
          const backoffMs = BACKOFF_MS[attempt - 1] ?? 750;

          if (debugCtx) {
            addDebugEvent(debugCtx, 'openrouter_retry', {
              callIndex,
              attempt,
              status: response.status,
              backoffMs,
              reason: '5xx_error',
            });
          }

          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw lastError;
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      if (debugCtx) {
        addDebugEvent(debugCtx, 'openrouter_call_end', {
          callIndex,
          status: 200,
          durationMs,
          success: true,
          stream: true,
        });
      }

      return response.body;
    } catch (fetchError) {
      const durationMs = Date.now() - startTime;
      lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));

      if (attempt < maxRetries && isNetworkError(fetchError)) {
        const backoffMs = BACKOFF_MS[attempt - 1] ?? 750;

        if (debugCtx) {
          addDebugEvent(debugCtx, 'openrouter_retry', {
            callIndex,
            attempt,
            backoffMs,
            reason: 'network_error',
            error: lastError.message.slice(0, 100),
          });
        }

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      if (debugCtx) {
        addDebugEvent(debugCtx, 'openrouter_error', {
          callIndex,
          durationMs,
          status: lastStatus,
          error: lastError.message.slice(0, 200),
          isRateLimit: lastStatus === 429,
        });
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Erro desconhecido no OpenRouter');
}

/**
 * Processa um stream de chat completion e extrai chunks
 */
export async function* parseStreamChunks(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<OpenRouterStreamChunk, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed === 'data: [DONE]') {
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const chunk = JSON.parse(jsonStr) as OpenRouterStreamChunk;
            yield chunk;
          } catch {
            // Ignora linhas que não são JSON válido
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Extrai texto completo de um stream de chunks
 */
export async function extractTextFromStream(
  stream: ReadableStream<Uint8Array>
): Promise<{
  content: string;
  toolCalls: OpenRouterToolCall[];
  finishReason: string | null;
}> {
  let content = '';
  const toolCalls: OpenRouterToolCall[] = [];
  let finishReason: string | null = null;
  const toolCallsMap = new Map<number, OpenRouterToolCall>();

  for await (const chunk of parseStreamChunks(stream)) {
    const choice = chunk.choices[0];

    if (choice.delta.content) {
      content += choice.delta.content;
    }

    if (choice.delta.tool_calls) {
      for (const tc of choice.delta.tool_calls) {
        const existing = toolCallsMap.get(tc.index);

        if (!existing) {
          toolCallsMap.set(tc.index, {
            id: tc.id ?? '',
            type: tc.type ?? 'function',
            function: {
              name: tc.function?.name ?? '',
              arguments: tc.function?.arguments ?? '',
            },
          });
        } else {
          if (tc.function?.arguments) {
            existing.function.arguments += tc.function.arguments;
          }
        }
      }
    }

    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
  }

  toolCalls.push(...toolCallsMap.values());

  return { content, toolCalls, finishReason };
}
