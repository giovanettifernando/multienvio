import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getSession } from '@/lib/auth/session';
import { checkoutCartSchema } from '@/lib/validation/cart';
import { processCartCheckout, type CartCheckoutResult } from '@/lib/cart';

// Tipo para resposta POST /api/cart/checkout
type CheckoutCartResponse = {
  message: string;
  idempotent: boolean;
  cartId: string;
  shipmentIds: string[];
  totalAmount: number;
};

/**
 * POST /api/cart/checkout
 * Cria shipments a partir dos itens do carrinho
 * Idempotente por cartId + hash dos itens
 */
export const POST = withApiHandler<CheckoutCartResponse>(async ({ req }) => {
  const session = await getSession();

  if (!session?.userId) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autorizado', status: 401 });
  }

  const body = await req.json();

  // Validar dados
  const validation = checkoutCartSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  const data = validation.data;

  // Processar checkout via service
  const result: CartCheckoutResult = await processCartCheckout({
    userId: session.userId,
    itemIds: data.itemIds,
    paymentMethod: data.paymentMethod,
  });

  return {
    data: {
      message: result.idempotent
        ? 'Checkout já processado anteriormente'
        : 'Shipments criados com sucesso',
      idempotent: result.idempotent,
      cartId: result.cartId,
      shipmentIds: result.shipmentIds,
      totalAmount: result.totalAmount,
    },
  };
});
