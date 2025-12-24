/**
 * POST /api/admin/config/openrouter/test
 *
 * Testa a conexão com o OpenRouter usando as credenciais salvas
 * ou credenciais fornecidas na requisição
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';

import { AdminPermission } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { testConnection as testOpenRouterConnection } from '@/platform/integrations/openrouter/client';
import { getOpenRouterConfigDecrypted } from '@/platform/integrations/openrouter/config.service';

/**
 * Response type for test endpoint
 */
interface TestConnectionResponse {
  success: boolean;
  message: string;
  keyInfo?: {
    label?: string;
    usage?: number;
    limit?: number | null;
    isFreeTier?: boolean;
    rateLimit?: {
      requests: number;
      interval: string;
    };
  };
}

/**
 * Schema para teste com credenciais temporárias
 */
const testCredentialsSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
}).optional();

/**
 * POST - Testa conexão com OpenRouter
 * Se apiKey for fornecida no body, usa ela temporariamente
 * Caso contrário, usa as credenciais salvas
 */
export const POST = withApiHandler<TestConnectionResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.INTEGRACOES);
  

  const body = await req.json().catch(() => ({}));
  const parsed = testCredentialsSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
    });
  }

  const tempCredentials = parsed.data;

  // Se forneceu credenciais temporárias, testa com elas
  if (tempCredentials?.apiKey) {
    const baseUrl = tempCredentials.baseUrl ?? 'https://openrouter.ai/api/v1';

    try {
      const response = await fetch(`${baseUrl}/key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tempCredentials.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          data: {
            success: false,
            message: `Erro ${response.status}: ${error}`,
          },
        };
      }

      const data = await response.json();

      return {
        data: {
          success: true,
          message: 'Conexão bem-sucedida',
          keyInfo: {
            label: data.data?.label,
            usage: data.data?.usage,
            limit: data.data?.limit,
            isFreeTier: data.data?.is_free_tier,
            rateLimit: data.data?.rate_limit,
          },
        },
      };
    } catch (error) {
      return {
        data: {
          success: false,
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        },
      };
    }
  }

  // Usa credenciais salvas
  const config = await getOpenRouterConfigDecrypted();

  if (!config) {
    throw new ApiError({
      code: 'NOT_CONFIGURED',
      message: 'OpenRouter não configurado. Salve as credenciais primeiro.',
      status: 400,
    });
  }

  const result = await testOpenRouterConnection();

  return {
    data: {
      success: result.success,
      message: result.message,
      keyInfo: result.data ? {
        label: result.data.label,
        usage: result.data.usage,
        limit: result.data.limit,
        isFreeTier: result.data.is_free_tier,
        rateLimit: result.data.rate_limit,
      } : undefined,
    },
  };
});
