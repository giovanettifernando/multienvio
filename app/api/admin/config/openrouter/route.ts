/**
 * GET /api/admin/config/openrouter
 * POST /api/admin/config/openrouter
 *
 * Rotas de configuração da integração OpenRouter (Admin)
 * Gerencia credenciais, modelo padrão e parâmetros de geração
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';

import { AdminPermission } from '@prisma/client';
import {
  getOpenRouterConfigSafe,
  saveOpenRouterConfig,
  invalidateOpenRouterConfigCache,
} from '@/platform/integrations/openrouter/config.service';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

/**
 * Schema de validação para configuração do OpenRouter
 */
const openRouterConfigSchema = z.object({
  apiKey: z.string().min(1, 'API Key é obrigatória'),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().min(1, 'Modelo padrão é obrigatório'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(100000).optional(),
  streamingEnabled: z.boolean().optional(),
  httpReferer: z.string().url().optional().nullable(),
  xTitle: z.string().optional().nullable(),
});

/**
 * GET - Busca configuração atual do OpenRouter
 * Retorna dados mascarados (API key parcialmente oculta)
 */
export const GET = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.INTEGRACOES);
  

  const reveal = req.nextUrl?.searchParams?.get('reveal') === 'true'
    || new URL(req.url).searchParams.get('reveal') === 'true';
  const config = await getOpenRouterConfigSafe(reveal);

  if (!config) {
    return {
      data: {
        configured: false,
        apiKey: '',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'anthropic/claude-3-haiku',
        temperature: 0.7,
        maxTokens: 2048,
        streamingEnabled: true,
        httpReferer: null,
        xTitle: null,
        isActive: false,
        lastUpdated: null,
      },
    };
  }

  return {
    data: {
      configured: true,
      apiKey: config.apiKeyMasked,
      baseUrl: config.baseUrl,
      defaultModel: config.defaultModel,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      streamingEnabled: config.streamingEnabled,
      httpReferer: config.httpReferer,
      xTitle: config.xTitle,
      isActive: config.isActive,
      lastUpdated: config.updatedAt,
    },
  };
});

/**
 * POST - Salva/atualiza configuração do OpenRouter
 */
export const POST = withApiHandler(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.INTEGRACOES);
  

  const body = await req.json();
  const parsed = openRouterConfigSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;

  await saveOpenRouterConfig({
    apiKey: data.apiKey,
    baseUrl: data.baseUrl,
    defaultModel: data.defaultModel,
    temperature: data.temperature,
    maxTokens: data.maxTokens,
    streamingEnabled: data.streamingEnabled,
    httpReferer: data.httpReferer ?? undefined,
    xTitle: data.xTitle ?? undefined,
    isActive: true,
  });

  // Invalidar cache
  invalidateOpenRouterConfigCache();

  return {
    data: {
      message: 'Configuração salva com sucesso',
    },
  };
});
