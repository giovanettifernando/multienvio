/**
 * Helpers para autenticação de webhooks
 *
 * Validação HMAC-SHA256 para webhooks externos
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Valida assinatura HMAC-SHA256 de um webhook
 *
 * Usa timingSafeEqual para prevenir timing attacks.
 *
 * @param signature Assinatura recebida no header (hex)
 * @param body Corpo da requisição como string
 * @param secret Segredo compartilhado para validação
 * @returns true se a assinatura é válida
 */
export function validateHmacSignature(
  signature: string | null,
  body: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Usar timingSafeEqual para prevenir timing attacks
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
