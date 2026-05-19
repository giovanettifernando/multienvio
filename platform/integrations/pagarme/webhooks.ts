import 'server-only';
import type { PagarmeWebhookPayload } from './types';
import { getOrder } from './orders';

export function extractOrderIdFromPayload(
  payload: PagarmeWebhookPayload & { data: Record<string, unknown> },
): string | undefined {
  const data = payload.data as Record<string, unknown>;

  // Order events: data.id = or_XXXX
  if (typeof data.id === 'string' && data.id.startsWith('or_')) {
    return data.id;
  }

  // Charge events: look for data.order.id
  const order = data.order as Record<string, unknown> | undefined;
  if (order && typeof order.id === 'string') {
    return order.id;
  }

  return undefined;
}

// Pagar.me has no HMAC. Verify by fetching the order from API.
export async function verifyWebhookEvent(
  payload: PagarmeWebhookPayload & { data: Record<string, unknown> },
): Promise<boolean> {
  const orderId = extractOrderIdFromPayload(payload);
  if (!orderId) return false;

  try {
    const order = await getOrder(orderId);
    return !!order.id;
  } catch {
    return false;
  }
}
