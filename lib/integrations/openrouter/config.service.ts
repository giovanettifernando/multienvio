/**
 * OpenRouter Configuration Service
 *
 * Gerencia a configuração do OpenRouter (API key, modelo, parâmetros).
 * Segue o padrão do sistema: singleton com cache e criptografia.
 */

import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/integrations/shared/encryption.service';
import type { OpenRouterConfig } from '@prisma/client';

// Cache da configuração em memória
let configCache: OpenRouterConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minuto

/**
 * Invalida o cache da configuração
 */
export function invalidateOpenRouterConfigCache(): void {
  configCache = null;
  cacheTimestamp = 0;
}

/**
 * Busca a configuração ativa do OpenRouter (com cache)
 */
export async function getOpenRouterConfig(): Promise<OpenRouterConfig | null> {
  const now = Date.now();

  // Retorna do cache se ainda válido
  if (configCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return configCache;
  }

  // Busca a configuração mais recente e ativa
  const config = await prisma.openRouterConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (config) {
    configCache = config;
    cacheTimestamp = now;
  }

  return config;
}

/**
 * Busca configuração com API key descriptografada (para uso interno apenas)
 */
export async function getOpenRouterConfigDecrypted(): Promise<
  (Omit<OpenRouterConfig, 'apiKey'> & { apiKey: string }) | null
> {
  const config = await getOpenRouterConfig();
  if (!config) return null;

  try {
    const decryptedKey = decrypt(config.apiKey);
    return { ...config, apiKey: decryptedKey };
  } catch {
    console.error('[OpenRouter] Erro ao descriptografar API key');
    return null;
  }
}

/**
 * Tipo para criação/atualização da configuração
 */
export type OpenRouterConfigInput = {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number;
  streamingEnabled?: boolean;
  httpReferer?: string | null;
  xTitle?: string | null;
  isActive?: boolean;
};

/**
 * Salva ou atualiza a configuração do OpenRouter
 * Desativa configurações anteriores (padrão singleton)
 */
export async function saveOpenRouterConfig(
  input: OpenRouterConfigInput
): Promise<OpenRouterConfig> {
  // Busca configuração existente
  const existing = await prisma.openRouterConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  // Prepara dados para salvar
  const data: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
    streamingEnabled?: boolean;
    httpReferer?: string | null;
    xTitle?: string | null;
    isActive?: boolean;
  } = {};

  // Criptografa API key se fornecida
  if (input.apiKey && input.apiKey !== '***') {
    data.apiKey = encrypt(input.apiKey);
  }

  if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
  if (input.defaultModel !== undefined) data.defaultModel = input.defaultModel;
  if (input.temperature !== undefined) data.temperature = input.temperature;
  if (input.maxTokens !== undefined) data.maxTokens = input.maxTokens;
  if (input.streamingEnabled !== undefined) data.streamingEnabled = input.streamingEnabled;
  if (input.httpReferer !== undefined) data.httpReferer = input.httpReferer;
  if (input.xTitle !== undefined) data.xTitle = input.xTitle;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  let config: OpenRouterConfig;

  if (existing) {
    // Atualiza configuração existente
    // Se não foi fornecida nova API key, mantém a existente
    if (!data.apiKey) {
      delete data.apiKey;
    }

    config = await prisma.openRouterConfig.update({
      where: { id: existing.id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  } else {
    // Cria nova configuração
    if (!data.apiKey) {
      throw new Error('API Key é obrigatória para criar configuração');
    }

    config = await prisma.openRouterConfig.create({
      data: {
        apiKey: data.apiKey,
        baseUrl: data.baseUrl ?? 'https://openrouter.ai/api/v1',
        defaultModel: data.defaultModel ?? 'anthropic/claude-3.5-haiku',
        temperature: data.temperature ?? 0.7,
        maxTokens: data.maxTokens ?? 2048,
        streamingEnabled: data.streamingEnabled ?? true,
        httpReferer: data.httpReferer ?? null,
        xTitle: data.xTitle ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  // Invalida cache
  invalidateOpenRouterConfigCache();

  return config;
}

/**
 * Retorna configuração segura para exibição (API key mascarada)
 */
export async function getOpenRouterConfigSafe(reveal = false): Promise<{
  configured: boolean;
  apiKeyMasked: string;
  baseUrl: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  streamingEnabled: boolean;
  httpReferer: string | null;
  xTitle: string | null;
  isActive: boolean;
  updatedAt: Date | null;
} | null> {
  const config = await getOpenRouterConfig();

  if (!config) {
    return null;
  }

  let apiKeyDisplay = '';
  if (config.apiKey) {
    if (reveal) {
      try {
        apiKeyDisplay = decrypt(config.apiKey);
      } catch {
        apiKeyDisplay = '***erro***';
      }
    } else {
      // Mostra apenas os últimos 4 caracteres
      try {
        const decrypted = decrypt(config.apiKey);
        apiKeyDisplay = `sk-...${decrypted.slice(-4)}`;
      } catch {
        apiKeyDisplay = '***configurado***';
      }
    }
  }

  return {
    configured: true,
    apiKeyMasked: apiKeyDisplay,
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    streamingEnabled: config.streamingEnabled,
    httpReferer: config.httpReferer,
    xTitle: config.xTitle,
    isActive: config.isActive,
    updatedAt: config.updatedAt,
  };
}

/**
 * Verifica se o OpenRouter está configurado e ativo
 */
export async function isOpenRouterConfigured(): Promise<boolean> {
  const config = await getOpenRouterConfig();
  return config !== null && config.isActive;
}
