"use client";

export interface CardData {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

/**
 * Tokeniza um cartão diretamente na API do Pagar.me usando a chave pública.
 * Retorna o token (token_XXXX) para uso único no backend.
 */
export async function tokenizeCard(card: CardData): Promise<string> {
  const res = await fetch('/api/payments/pagarme/public-key');
  if (!res.ok) throw new Error('Falha ao carregar configuração de pagamento');
  const json = await res.json();
  const { publicKey, baseUrl } = json.data ?? json;

  const tokenRes = await fetch(`${baseUrl}/tokens?appId=${publicKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'card',
      card: {
        number: card.number.replace(/\D/g, ''),
        holder_name: card.holderName,
        exp_month: parseInt(card.expMonth, 10),
        exp_year: parseInt(card.expYear, 10),
        cvv: card.cvv,
      },
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(err?.message || 'Falha ao tokenizar cartão');
  }

  const tokenData = await tokenRes.json();
  if (!tokenData?.id) throw new Error('Token inválido retornado pelo Pagar.me');
  return tokenData.id as string;
}
