/**
 * HTTP client for Pagar.me API
 *
 * Provides Basic Auth header building, webhook event status mapping,
 * and an authenticated fetch wrapper.
 */

import 'server-only';
import { getPagarmeConfig } from './config';
import { PagarmeApiError } from './types';
import type { TransactionStatus } from '@prisma/client';

/**
 * Builds the Authorization header for Pagar.me Basic Auth.
 * Pagar.me uses `secretKey:` (with empty password) encoded in base64.
 */
export function buildBasicAuthHeader(secretKey: string): string {
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

/**
 * Maps a Pagar.me webhook event type to the internal TransactionStatus enum.
 * Falls back to PENDING for unrecognised event types.
 */
export function mapOrderStatus(eventType: string): TransactionStatus {
  const map: Record<string, TransactionStatus> = {
    'order.paid': 'PAID',
    'charge.paid': 'PAID',
    'order.payment_failed': 'FAILED',
    'charge.chargedback': 'CHARGEBACK',
    'charge.refunded': 'REFUNDED',
    'charge.pending': 'PENDING',
    'order.pending': 'PENDING',
  };
  return map[eventType] ?? 'PENDING';
}

/**
 * Makes an authenticated request to the Pagar.me API.
 *
 * @throws PagarmeApiError if not configured or if the API returns a non-2xx status
 */
export async function pagarmeRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const config = await getPagarmeConfig();
  if (!config) {
    throw new PagarmeApiError('NOT_CONFIGURED', 'Pagar.me não configurado');
  }

  const url = `${config.baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildBasicAuthHeader(config.secretKey),
      'User-Agent': 'envio-legal/1.0',
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (!res.ok) {
    let message = `Pagar.me error ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      message = body.message || message;
    } catch {
      /* ignore parse errors */
    }
    throw new PagarmeApiError('API_ERROR', message, res.status);
  }

  return res.json() as Promise<T>;
}
