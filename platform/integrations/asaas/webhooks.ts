import 'server-only';
import { timingSafeEqual } from 'crypto';
import type { AsaasCharge } from './types';

/**
 * Valida o header `asaas-access-token`.
 *
 * O valor é definido por nós ao cadastrar o webhook no painel do Asaas.
 * Se não houver token configurado, a validação FALHA — nunca aceitar por omissão,
 * senão o endpoint fica aberto para qualquer origem.
 */
export function verifyWebhookToken(
  receivedToken: string | null,
  expectedToken?: string,
): boolean {
  if (!expectedToken || !receivedToken) return false;

  const a = Buffer.from(receivedToken);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function extractChargeFromPayload(payload: unknown): AsaasCharge | null {
  if (!payload || typeof payload !== 'object') return null;
  const payment = (payload as { payment?: unknown }).payment;
  if (!payment || typeof payment !== 'object') return null;
  if (typeof (payment as { id?: unknown }).id !== 'string') return null;
  return payment as AsaasCharge;
}

const RELEVANT_EVENTS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_RECEIVED_IN_CASH',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
]);

/** Eventos como PAYMENT_CREATED/UPDATED não alteram nosso estado e são ignorados. */
export function isRelevantEvent(event: string): boolean {
  return RELEVANT_EVENTS.has(event);
}
