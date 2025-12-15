/**
 * POST /api/cart/checkout-paid
 *
 * Cria shipments do carrinho SOMENTE após confirmação de pagamento.
 * Esta é a nova rota que substitui o fluxo antigo onde os shipments
 * eram criados antes do pagamento.
 *
 * Fluxo:
 * 1. Frontend reserva N códigos de rastreamento (ao abrir modal de checkout)
 * 2. Usuário confirma pagamento (carteira, PIX ou cartão)
 * 3. Frontend chama esta rota com os códigos reservados + método de pagamento
 * 4. Backend cria shipments + debita carteira (se wallet) atomicamente
 * 5. Emails são enviados aos destinatários
 */

import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { createCartShipmentsWithPayment, CartPaymentMethod } from '@/lib/cart/create-cart-shipments-with-payment.service';
import { enforceRateLimitByIP, RATE_LIMITS } from '@/lib/rate-limit-redis';
import { logger } from '@/lib/logger';

/**
 * Resposta da API
 */
interface CartCheckoutPaidResponse {
  shipmentIds: string[];
  trackingCodes: string[];
  walletTransactionId: string | null;
  totalAmount: number;
  message: string;
}

// Schema de validação
const cartCheckoutPaidSchema = z.object({
  /** Códigos de rastreamento reservados (um por item) */
  reservedTrackingCodes: z.array(z.string()).min(1, 'Pelo menos um código de rastreamento é obrigatório'),
  /** IDs dos itens do carrinho a processar */
  itemIds: z.array(z.string()).min(1, 'Pelo menos um item é obrigatório'),
  /** Método de pagamento */
  paymentMethod: z.enum(['WALLET', 'MERCADO_PAGO']),
  /** ID do pagamento MercadoPago (se aplicável) */
  mercadoPagoPaymentId: z.string().optional(),
});

export const POST = withApiHandler<CartCheckoutPaidResponse>(async ({ req }) => {
  // Rate limiting
  await enforceRateLimitByIP(req as NextRequest, 'checkout', RATE_LIMITS.CHECKOUT);

  // Autenticar usuário
  const session = await getUserSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autenticado', status: 401 });
  }

  // Parse e validar payload
  const body = await req.json();
  const parsed = cartCheckoutPaidSchema.safeParse(body);

  if (!parsed.success) {
    logger.debug({
      event: 'cart_checkout_paid_validation_error',
      errors: parsed.error.flatten(),
    }, 'Validation failed');

    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;

  // Validar que temos o mesmo número de códigos e itens
  if (data.reservedTrackingCodes.length !== data.itemIds.length) {
    throw new ApiError({
      code: 'TRACKING_CODE_MISMATCH',
      message: `Número de códigos (${data.reservedTrackingCodes.length}) não corresponde ao número de itens (${data.itemIds.length})`,
      status: 400,
    });
  }

  logger.info({
    event: 'cart_checkout_paid_request',
    trackingCodes: data.reservedTrackingCodes,
    paymentMethod: data.paymentMethod,
    userId: session.userId,
    itemCount: data.itemIds.length,
  }, 'Processing paid cart checkout');

  try {
    // Criar shipments com pagamento
    const result = await createCartShipmentsWithPayment({
      userId: session.userId,
      reservedTrackingCodes: data.reservedTrackingCodes,
      itemIds: data.itemIds,
      paymentMethod: data.paymentMethod as CartPaymentMethod,
      mercadoPagoPaymentId: data.mercadoPagoPaymentId,
    });

    logger.info({
      event: 'cart_checkout_paid_success',
      trackingCodes: result.trackingCodes,
      shipmentIds: result.shipmentIds,
      isIdempotent: result.isIdempotent,
    }, 'Cart shipments created successfully');

    return {
      data: {
        shipmentIds: result.shipmentIds,
        trackingCodes: result.trackingCodes,
        walletTransactionId: result.walletTransactionId,
        totalAmount: result.totalAmount,
        message: result.isIdempotent
          ? 'Checkout já foi processado anteriormente.'
          : 'Envios criados com sucesso!',
      },
    };

  } catch (error) {
    // Tratar erros específicos
    if (error instanceof Error) {
      const errorCode = 'code' in error ? (error as { code: string }).code : null;

      if (errorCode === 'WALLET_NOT_FOUND') {
        throw new ApiError({
          code: 'wallet_not_found',
          message: 'Carteira não encontrada. Entre em contato com o suporte.',
          status: 400,
        });
      }

      if (errorCode === 'INSUFFICIENT_FUNDS') {
        throw new ApiError({
          code: 'insufficient_funds',
          message: 'Saldo insuficiente na carteira.',
          status: 400,
        });
      }

      if (errorCode === 'CART_NOT_FOUND') {
        throw new ApiError({
          code: 'cart_not_found',
          message: 'Carrinho não encontrado.',
          status: 404,
        });
      }

      if (errorCode === 'TRACKING_CODE_MISMATCH') {
        throw new ApiError({
          code: 'tracking_code_mismatch',
          message: error.message,
          status: 400,
        });
      }

      if (errorCode === 'INVALID_TRACKING_CODE') {
        throw new ApiError({
          code: 'invalid_tracking_code',
          message: 'Código(s) de rastreamento inválido(s), expirado(s) ou não autorizado(s). Reabra o carrinho e tente novamente.',
          status: 400,
        });
      }
    }

    logger.error({
      event: 'cart_checkout_paid_error',
      trackingCodes: data.reservedTrackingCodes,
      err: error,
    }, 'Failed to create cart shipments');

    throw new ApiError({
      code: 'CART_CHECKOUT_ERROR',
      message: 'Erro ao criar envios. Por favor, tente novamente.',
      status: 500,
    });
  }
});
