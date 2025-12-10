/**
 * GET /api/payments/mercadopago/public-key
 *
 * Retorna a chave pública do Mercado Pago para uso no frontend
 * Esta chave é segura para ser exposta publicamente
 */


import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getMercadoPagoPublicKey } from '@/lib/mercadopago/config';

type PublicKeyResponse = {
  publicKey: string;
};

export const GET = withApiHandler<PublicKeyResponse>(async () => {
  const publicKey = await getMercadoPagoPublicKey();

  if (!publicKey) {
    throw new ApiError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Configure as credenciais do Mercado Pago no painel admin ou nas variáveis de ambiente',
      status: 503,
    });
  }

  return {
    data: {
      publicKey,
    },
  };
});
