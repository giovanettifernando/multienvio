/**
 * GET /api/payments/pagarme/public-key
 *
 * Retorna a chave pública do Pagar.me para uso no frontend
 * Esta chave é segura para ser exposta publicamente
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getPagarmeConfig } from '@/platform/integrations/pagarme';

type PublicKeyResponse = {
  publicKey: string;
  baseUrl: string;
};

export const GET = withApiHandler<PublicKeyResponse>(async () => {
  const config = await getPagarmeConfig();

  if (!config) {
    throw new ApiError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Configure as credenciais do Pagar.me no painel admin ou nas variáveis de ambiente',
      status: 503,
    });
  }

  return {
    data: {
      publicKey: config.publicKey,
      baseUrl: config.baseUrl,
    },
  };
});
