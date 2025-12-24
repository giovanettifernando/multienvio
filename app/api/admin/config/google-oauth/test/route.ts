/**
 * POST /api/admin/config/google-oauth/test
 *
 * Testa as credenciais Google OAuth
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';

import { AdminPermission } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getRedirectUri } from '@/modules/auth/application/google-oauth';

const testSchema = z.object({
  clientId: z.string().min(1, 'Client ID é obrigatório'),
  clientSecret: z.string().min(1, 'Client Secret é obrigatório'),
});

/**
 * Tipo de resposta do teste OAuth
 */
interface GoogleOAuthTestResponse {
  success: boolean;
  error?: string;
  message?: string;
  warning?: string;
  details?: unknown;
  latencyMs: number;
}

/**
 * POST - Testa as credenciais
 */
export const POST = withApiHandler<GoogleOAuthTestResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.CONFIGURACOES);
  

  const body = await req.json();
  const parsed = testSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { clientId, clientSecret } = parsed.data;
  const startTime = Date.now();

  // Testar credenciais fazendo uma requisição ao endpoint de descoberta do Google
  // Isso verifica se o Client ID é válido
  try {
    // Primeiro, verificar se o Client ID parece válido
    if (!clientId.includes('.apps.googleusercontent.com')) {
      return {
        data: {
          success: false,
          error: 'Client ID inválido. Deve terminar com .apps.googleusercontent.com',
          latencyMs: Date.now() - startTime,
        },
      };
    }

    // Verificar se o Client Secret tem o formato correto (começa com GOCSPX-)
    if (!clientSecret.startsWith('GOCSPX-')) {
      return {
        data: {
          success: false,
          error: 'Client Secret inválido. Deve começar com GOCSPX-',
          latencyMs: Date.now() - startTime,
        },
      };
    }

    // Fazer uma requisição de teste ao endpoint de token
    // Usamos um code inválido propositalmente para verificar se as credenciais são reconhecidas
    const testResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: 'test_invalid_code',
        redirect_uri: getRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });

    const responseData = await testResponse.json();
    const latency = Date.now() - startTime;

    // Se o erro for "invalid_grant", significa que as credenciais são válidas
    // mas o código de autorização é inválido (o que é esperado no teste)
    if (responseData.error === 'invalid_grant') {
      return {
        data: {
          success: true,
          message: 'Credenciais válidas! O Google reconheceu o Client ID e Secret.',
          details: {
            clientIdValid: true,
            clientSecretValid: true,
            googleResponse: 'invalid_grant (esperado para código de teste)',
          },
          latencyMs: latency,
        },
      };
    }

    // Se o erro for "invalid_client", as credenciais estão erradas
    if (responseData.error === 'invalid_client') {
      return {
        data: {
          success: false,
          error: 'Credenciais inválidas. Verifique o Client ID e Client Secret.',
          details: responseData,
          latencyMs: latency,
        },
      };
    }

    // Se o erro for "unauthorized_client", o redirect_uri não está configurado
    if (responseData.error === 'unauthorized_client') {
      const currentRedirectUri = getRedirectUri();
      return {
        data: {
          success: true,
          message: 'Credenciais válidas, mas o URI de redirecionamento não está autorizado.',
          warning: `Configure este redirect_uri no Google Cloud Console: ${currentRedirectUri}`,
          details: {
            clientIdValid: true,
            clientSecretValid: true,
            redirectUriConfigured: false,
            requiredRedirectUri: currentRedirectUri,
          },
          latencyMs: latency,
        },
      };
    }

    // Outro erro não esperado
    return {
      data: {
        success: false,
        error: `Resposta inesperada do Google: ${responseData.error || 'desconhecido'}`,
        details: responseData,
        latencyMs: latency,
      },
    };
  } catch (fetchError) {
    const latency = Date.now() - startTime;
    console.error('[GOOGLE_OAUTH_TEST] Fetch error:', fetchError);
    return {
      data: {
        success: false,
        error: 'Erro ao conectar com o Google. Verifique sua conexão.',
        details: fetchError instanceof Error ? fetchError.message : 'Erro desconhecido',
        latencyMs: latency,
      },
    };
  }
});
