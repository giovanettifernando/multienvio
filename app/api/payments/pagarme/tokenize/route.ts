import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getPagarmeConfig } from '@/platform/integrations/pagarme';

type TokenizeRequest = {
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  cvv: string;
};

type TokenizeResponse = {
  token: string;
};

export const POST = withApiHandler<TokenizeResponse>(async (context) => {
  const body = (await context.req.json()) as TokenizeRequest;

  if (!body.number || !body.holderName || !body.expMonth || !body.expYear || !body.cvv) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Dados do cartão incompletos', status: 400 });
  }

  const config = await getPagarmeConfig();
  if (!config) {
    throw new ApiError({ code: 'SERVICE_UNAVAILABLE', message: 'Gateway de pagamento não configurado', status: 503 });
  }

  // Token creation always uses api.pagar.me regardless of sandbox mode
  // (pk_test_ key signals test mode to Pagar.me; sdx-api.pagar.me is for orders only)
  const tokenBaseUrl = 'https://api.pagar.me/core/v5';
  const res = await fetch(`${tokenBaseUrl}/tokens?appId=${config.publicKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'card',
      card: {
        number: body.number.replace(/\D/g, ''),
        holder_name: body.holderName,
        exp_month: body.expMonth,
        exp_year: body.expYear,
        cvv: body.cvv,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[PAGARME_TOKENIZE] Error:', JSON.stringify({ status: res.status, url: `${config.baseUrl}/tokens?appId=***`, body: err }));
    const msg = (err as { message?: string })?.message || 'Falha ao tokenizar cartão';
    throw new ApiError({ code: 'PAYMENT_ERROR', message: msg, status: 422 });
  }

  const data = (await res.json()) as { id: string };
  if (!data?.id) {
    throw new ApiError({ code: 'PAYMENT_ERROR', message: 'Token inválido retornado pelo Pagar.me', status: 502 });
  }

  return { data: { token: data.id } };
});
