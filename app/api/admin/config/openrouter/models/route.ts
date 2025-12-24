/**
 * GET /api/admin/config/openrouter/models
 *
 * Lista modelos disponíveis no OpenRouter
 * Requer autenticação admin e configuração válida do OpenRouter
 */

import { AdminPermission } from '@prisma/client';
import { requireAdminSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { listModels, type OpenRouterModel } from '@/platform/integrations/openrouter/client';
import { isOpenRouterConfigured } from '@/platform/integrations/openrouter/config.service';

/**
 * Response type for models list endpoint
 */
interface FormattedModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  maxCompletionTokens?: number;
  pricing: {
    prompt: string;
    completion: string;
    promptRaw: number;
    completionRaw: number;
  };
  modality?: string;
  isModerated?: boolean;
}

interface ModelsListResponse {
  // When category is specified
  category?: string;
  models: FormattedModel[] | Record<string, FormattedModel[]>;
  totalCount: number;
  categories?: string[];
}

/**
 * Categoriza modelos por provedor para facilitar exibição
 */
function categorizeModels(models: OpenRouterModel[]) {
  const categories: Record<string, OpenRouterModel[]> = {};

  for (const model of models) {
    // Extrai o provedor do ID do modelo (ex: "anthropic/claude-3" -> "anthropic")
    const provider = model.id.split('/')[0] || 'other';

    if (!categories[provider]) {
      categories[provider] = [];
    }
    categories[provider].push(model);
  }

  // Ordena modelos dentro de cada categoria por nome
  for (const provider of Object.keys(categories)) {
    categories[provider].sort((a, b) => a.name.localeCompare(b.name));
  }

  return categories;
}

/**
 * Formata informações de preço para exibição
 */
function formatModelInfo(model: OpenRouterModel): FormattedModel {
  const promptPrice = parseFloat(model.pricing.prompt);
  const completionPrice = parseFloat(model.pricing.completion);

  // Preço por 1M tokens
  const promptPer1M = promptPrice * 1_000_000;
  const completionPer1M = completionPrice * 1_000_000;

  return {
    id: model.id,
    name: model.name,
    description: model.description,
    contextLength: model.context_length,
    maxCompletionTokens: model.top_provider?.max_completion_tokens,
    pricing: {
      prompt: `$${promptPer1M.toFixed(2)}/1M tokens`,
      completion: `$${completionPer1M.toFixed(2)}/1M tokens`,
      promptRaw: promptPrice,
      completionRaw: completionPrice,
    },
    modality: model.architecture?.modality,
    isModerated: model.top_provider?.is_moderated,
  };
}

/**
 * GET - Lista modelos disponíveis no OpenRouter
 * Query params:
 *   - category: Filtra por provedor (ex: "anthropic", "openai")
 *   - search: Busca por nome ou ID do modelo
 */
export const GET = withApiHandler<ModelsListResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.INTEGRACOES);
  

  // Verifica se OpenRouter está configurado
  const configured = await isOpenRouterConfigured();
  if (!configured) {
    throw new ApiError({
      code: 'NOT_CONFIGURED',
      message: 'OpenRouter não configurado. Configure as credenciais primeiro.',
      status: 400,
    });
  }

  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search')?.toLowerCase();

  try {
    let models = await listModels();

    // Filtra por busca se fornecida
    if (search) {
      models = models.filter(
        (m) =>
          m.id.toLowerCase().includes(search) ||
          m.name.toLowerCase().includes(search) ||
          m.description?.toLowerCase().includes(search)
      );
    }

    // Categoriza modelos
    const categorized = categorizeModels(models);

    // Se categoria específica solicitada, retorna apenas ela
    if (category && categorized[category]) {
      return {
        data: {
          category,
          models: categorized[category].map(formatModelInfo),
          totalCount: categorized[category].length,
        },
      };
    }

    // Retorna todos categorizados
    const formattedCategories: Record<string, ReturnType<typeof formatModelInfo>[]> = {};
    let totalCount = 0;

    for (const [provider, providerModels] of Object.entries(categorized)) {
      formattedCategories[provider] = providerModels.map(formatModelInfo);
      totalCount += providerModels.length;
    }

    // Lista ordenada de provedores populares primeiro
    const providerOrder = [
      'anthropic',
      'openai',
      'google',
      'meta-llama',
      'mistralai',
      'cohere',
    ];

    const sortedProviders = Object.keys(formattedCategories).sort((a, b) => {
      const aIndex = providerOrder.indexOf(a);
      const bIndex = providerOrder.indexOf(b);

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    return {
      data: {
        categories: sortedProviders,
        models: formattedCategories,
        totalCount,
      },
    };
  } catch (error) {
    throw new ApiError({
      code: 'OPENROUTER_ERROR',
      message: error instanceof Error ? error.message : 'Erro ao listar modelos',
      status: 500,
    });
  }
});
