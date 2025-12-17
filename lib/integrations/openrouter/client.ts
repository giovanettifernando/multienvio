/**
 * OpenRouter API Client
 *
 * Cliente para chamadas à API do OpenRouter.
 * Suporta chat completions, streaming e listagem de modelos.
 *
 * @see https://openrouter.ai/docs
 */

import { getOpenRouterConfigDecrypted } from './config.service';

// ============================================================================
// Types
// ============================================================================

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  // For assistant messages that include tool calls
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
  // OpenRouter specific
  route?: 'fallback';
  transforms?: string[];
  // Provider preferences for tool use
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
// Client
// ============================================================================

/**
 * Obtém headers para requisições ao OpenRouter
 */
async function getHeaders(): Promise<HeadersInit> {
  const config = await getOpenRouterConfigDecrypted();

  if (!config) {
    throw new Error('OpenRouter não configurado');
  }

  console.log('[OpenRouter] API Key decrypted (last 8 chars):', config.apiKey ? `...${config.apiKey.slice(-8)}` : 'EMPTY');

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

/**
 * Obtém a URL base da API
 */
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
 */
export async function chatCompletion(
  request: OpenRouterChatRequest
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

  // Add routing configuration for tool use - require providers that support tools
  // For free models, we allow fallbacks since availability is limited
  if (request.tools && request.tools.length > 0) {
    const isFreeModel = body.model?.includes(':free');

    if (isFreeModel) {
      // For free models, just require tool support but allow any provider
      body.provider = {
        require_parameters: true,
        allow_fallbacks: true,
      };
    } else {
      // For paid models, prefer the specific provider
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
  const maxRetries = isFreeModel ? 3 : 1;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[OpenRouter] Attempt ${attempt}/${maxRetries} - Making request to:`, `${baseUrl}/chat/completions`);
      console.log('[OpenRouter] Model:', body.model);
      console.log('[OpenRouter] Tools count:', body.tools?.length ?? 0);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // For free models, retry on 404/429/503 errors
        if (isFreeModel && attempt < maxRetries && [404, 429, 503].includes(response.status)) {
          console.log(`[OpenRouter] Retryable error ${response.status}, waiting before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          lastError = new Error(`Erro OpenRouter: ${response.status} - ${errorText}`);
          continue;
        }

        throw new Error(`Erro OpenRouter: ${response.status} - ${errorText}`);
      }

      return (await response.json()) as OpenRouterChatResponse;
    } catch (fetchError) {
      lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));

      if (attempt < maxRetries) {
        console.log(`[OpenRouter] Error on attempt ${attempt}, retrying...`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      console.error('[OpenRouter] All retries failed:', lastError);
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
  request: OpenRouterChatRequest
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

  // Add routing configuration for tool use - require providers that support tools
  // For free models, we allow fallbacks since availability is limited
  if (request.tools && request.tools.length > 0) {
    const isFreeModel = body.model?.includes(':free');

    if (isFreeModel) {
      // For free models, just require tool support but allow any provider
      body.provider = {
        require_parameters: true,
        allow_fallbacks: true,
      };
    } else {
      // For paid models, prefer the specific provider
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
  const maxRetries = isFreeModel ? 3 : 1;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[OpenRouter Stream] Attempt ${attempt}/${maxRetries} - Making request to:`, `${baseUrl}/chat/completions`);
      console.log('[OpenRouter Stream] Model:', body.model);
      console.log('[OpenRouter Stream] Tools count:', body.tools?.length ?? 0);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // For free models, retry on 404/429/503 errors
        if (isFreeModel && attempt < maxRetries && [404, 429, 503].includes(response.status)) {
          console.log(`[OpenRouter Stream] Retryable error ${response.status}, waiting before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          lastError = new Error(`Erro OpenRouter: ${response.status} - ${errorText}`);
          continue;
        }

        throw new Error(`Erro OpenRouter: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      return response.body;
    } catch (fetchError) {
      lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));

      if (attempt < maxRetries) {
        console.log(`[OpenRouter Stream] Error on attempt ${attempt}, retrying...`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      console.error('[OpenRouter Stream] All retries failed:', lastError);
      throw lastError;
    }
  }

  throw lastError || new Error('Erro desconhecido no OpenRouter');
}

/**
 * Processa um stream de chat completion e extrai chunks
 * Útil para parsing server-side antes de reenviar ao cliente
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
            console.warn('[OpenRouter] Invalid JSON chunk:', jsonStr);
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

    // Processa tool calls incrementais
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

  // Converte map para array
  toolCalls.push(...toolCallsMap.values());

  return { content, toolCalls, finishReason };
}
