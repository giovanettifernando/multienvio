import 'server-only';
import { pagarmeRequest } from './client';
import type { PagarmeCard } from './types';

interface PagarmeCardListResponse {
  data: PagarmeCard[];
  paging: { total: number };
}

// Saves a tokenized card to customer vault. Idempotent: same card returns same card_id.
export async function createPagarmeCard(
  customerId: string,
  token: string,
): Promise<PagarmeCard> {
  return pagarmeRequest<PagarmeCard>(`/customers/${customerId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function listPagarmeCards(customerId: string): Promise<PagarmeCard[]> {
  const res = await pagarmeRequest<PagarmeCardListResponse>(`/customers/${customerId}/cards`);
  return res.data ?? [];
}

export async function deletePagarmeCard(
  customerId: string,
  cardId: string,
): Promise<PagarmeCard> {
  return pagarmeRequest<PagarmeCard>(`/customers/${customerId}/cards/${cardId}`, {
    method: 'DELETE',
  });
}
