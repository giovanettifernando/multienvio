export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

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
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const params = await props.params;
    const { id: cartId } = params;

    // Buscar carrinho
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
    });

    if (!cart) {
      return NextResponse.json({ message: 'Carrinho não encontrado' }, { status: 404 });
    }

    // Verificar se o carrinho pertence ao usuário
    if (cart.userId !== session.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 403 });
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

    return NextResponse.json({
      message: 'Carrinho desbloqueado e limpo com sucesso',
      cartId,
      cleaned: true,
    });
  } catch (error) {
    console.error('[CART_UNLOCK]', error);
    return NextResponse.json(
      { message: 'Erro ao desbloquear carrinho' },
      { status: 500 }
    );
  }
}
