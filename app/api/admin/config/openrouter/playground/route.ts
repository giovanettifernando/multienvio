/**
 * POST /api/admin/config/openrouter/playground
 *
 * Endpoint de teste para enviar mensagens e ver a resposta bruta do OpenRouter
 * Usado para debug e avaliação de modelos
 */

import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getOpenRouterConfigDecrypted } from '@/lib/integrations/openrouter/config.service';
import { ASSISTANT_TOOLS } from '@/lib/assistant/tools/definitions';

/**
 * Schema para request do playground
 */
const playgroundSchema = z.object({
  message: z.string().min(1, 'Mensagem é obrigatória'),
  model: z.string().optional(),
  useTools: z.boolean().optional().default(false),
  systemPrompt: z.string().optional(),
});

/**
 * Response type for playground
 */
interface PlaygroundResponse {
  success: boolean;
  duration: number;
  debug: {
    url: string;
    apiKeyLast8: string;
    baseUrl: string;
  };
  request: {
    model: string;
    messages: unknown[];
    tools?: unknown[];
    provider?: unknown;
  };
  response: {
    raw: unknown;
    content: string | null;
    toolCalls: unknown[];
    finishReason: string | null;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
  };
  error?: string;
}

export const POST = withApiHandler<PlaygroundResponse>(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.INTEGRACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  // Buscar configuração
  const config = await getOpenRouterConfigDecrypted();
  if (!config) {
    throw new ApiError({
      code: 'NOT_CONFIGURED',
      message: 'OpenRouter não configurado',
      status: 400,
    });
  }

  // Validar request
  const body = await req.json();
  const parsed = playgroundSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { message, model, useTools, systemPrompt } = parsed.data;
  const targetModel = model || config.defaultModel;

  // Montar mensagens
  const messages: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: message });

  // Montar request body
  const requestBody: Record<string, unknown> = {
    model: targetModel,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  };

  // Adicionar tools se solicitado
  if (useTools) {
    requestBody.tools = ASSISTANT_TOOLS;
    requestBody.tool_choice = 'auto';

    // Provider config para tool support
    const isFreeModel = targetModel.includes(':free');
    if (isFreeModel) {
      requestBody.provider = {
        require_parameters: true,
        allow_fallbacks: true,
      };
    } else {
      const modelProvider = targetModel.split('/')[0];
      const providerName = modelProvider
        ? modelProvider.charAt(0).toUpperCase() + modelProvider.slice(1)
        : 'Anthropic';

      requestBody.provider = {
        order: [providerName],
        require_parameters: true,
        allow_fallbacks: true,
      };
    }
  }

  const startTime = Date.now();
  const fullUrl = `${config.baseUrl}/chat/completions`;
  const apiKeyLast8 = config.apiKey ? `...${config.apiKey.slice(-8)}` : 'EMPTY';

  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.httpReferer && { 'HTTP-Referer': config.httpReferer }),
        ...(config.xTitle && { 'X-Title': config.xTitle }),
      },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        data: {
          success: false,
          duration,
          debug: {
            url: fullUrl,
            apiKeyLast8,
            baseUrl: config.baseUrl,
          },
          request: {
            model: targetModel,
            messages,
            tools: useTools ? ASSISTANT_TOOLS : undefined,
            provider: requestBody.provider,
          },
          response: {
            raw: { status: response.status, error: errorText },
            content: null,
            toolCalls: [],
            finishReason: null,
            usage: null,
          },
          error: `Erro ${response.status}: ${errorText}`,
        },
      };
    }

    const rawResponse = await response.json();
    const choice = rawResponse.choices?.[0];

    return {
      data: {
        success: true,
        duration,
        debug: {
          url: fullUrl,
          apiKeyLast8,
          baseUrl: config.baseUrl,
        },
        request: {
          model: targetModel,
          messages,
          tools: useTools ? ASSISTANT_TOOLS : undefined,
          provider: requestBody.provider,
        },
        response: {
          raw: rawResponse,
          content: choice?.message?.content ?? null,
          toolCalls: choice?.message?.tool_calls ?? [],
          finishReason: choice?.finish_reason ?? null,
          usage: rawResponse.usage
            ? {
                promptTokens: rawResponse.usage.prompt_tokens,
                completionTokens: rawResponse.usage.completion_tokens,
                totalTokens: rawResponse.usage.total_tokens,
              }
            : null,
        },
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return {
      data: {
        success: false,
        duration,
        debug: {
          url: fullUrl,
          apiKeyLast8,
          baseUrl: config.baseUrl,
        },
        request: {
          model: targetModel,
          messages,
          tools: useTools ? ASSISTANT_TOOLS : undefined,
          provider: requestBody.provider,
        },
        response: {
          raw: { error: errorMessage },
          content: null,
          toolCalls: [],
          finishReason: null,
          usage: null,
        },
        error: errorMessage,
      },
    };
  }
});
