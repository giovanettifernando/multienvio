import { Prisma } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';

// Tipo para resposta POST /api/cart/[id]/unlock
type UnlockCartResponse = {
  message: string;
  cartId: string;
  cleaned: boolean;
};

// Tipo para parâmetros da rota
type UnlockCartParams = {
  id: string;
};

/**
 * POST /api/cart/[id]/unlock
 * Desbloqueia um carrinho que estava locked (reverte checkout não pago)
 *
 * Comportamento:
 * - Deleta TODOS os itens do carrinho (CartItem)
 * - Reseta campo totals para null (limpa subtotal, discount, total)
 * - Limpa meta (remove fingerprints antigos, totais defasados, etc)
 * - Muda status para OPEN
 * - Usa transação atômica para garantir consistência
 *
 * Chamado automaticamente no rollback de pagamento (CheckoutCartModal)
 * quando o débito falha após criar shipments.
 */
export const POST = withApiHandler<UnlockCartResponse, UnlockCartParams>(async (context) => {
  const session = await getUserFromRequest(context.req);

  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const { id: cartId } = await context.params;

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
  });

  if (!cart) {
    throw new ApiError({ code: 'not_found', message: 'Carrinho não encontrado', status: 404 });
  }

  if (cart.userId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Não autorizado', status: 403 });
  }

  // 🧹 LIMPAR CARRINHO: Desbloquear e limpar todos os dados para evitar estado inconsistente
  // Usar transação atômica para garantir que todos os dados sejam limpos corretamente
  await prisma.$transaction(async (tx) => {
    // 1. Deletar todos os itens do carrinho
    await tx.cartItem.deleteMany({
      where: { cartId },
    });

    // 2. Resetar carrinho: status OPEN, totais zerados, meta limpo
    await tx.cart.update({
      where: { id: cartId },
      data: {
        status: 'OPEN',
        totals: Prisma.JsonNull, // Limpar totais (JSON field)
        meta: {
          unlockedAt: new Date().toISOString(),
          reason: 'Payment rollback - cart cleaned',
        },
      },
    });
  });

  return {
    data: {
      message: 'Carrinho desbloqueado e limpo com sucesso',
      cartId,
      cleaned: true,
    },
  };
});
