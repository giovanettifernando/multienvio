"use client";

export interface CardData {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

/**
 * Tokeniza um cartão via proxy do backend, que chama a API do Pagar.me.
 * Retorna o token (token_XXXX) para uso único no pagamento.
 */
export async function tokenizeCard(card: CardData): Promise<string> {
  const res = await fetch('/api/payments/pagarme/tokenize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: card.number.replace(/\D/g, ''),
      holderName: card.holderName,
      expMonth: parseInt(card.expMonth, 10),
      expYear: parseInt(card.expYear.length === 2 ? `20${card.expYear}` : card.expYear, 10),
      cvv: card.cvv,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error((json as { error?: { message?: string } })?.error?.message || 'Falha ao tokenizar cartão');
  }

  const token = ((json as { data?: { token?: string } })?.data ?? json as { token?: string })?.token;
  if (!token) throw new Error('Token inválido retornado pelo Pagar.me');
  return token;
}
