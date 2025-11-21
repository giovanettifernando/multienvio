export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * POST /api/cart/[id]/unlock
 * Desbloqueia um carrinho que estava locked (reverte checkout não pago)
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

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

    // Desbloquear carrinho
    await prisma.cart.update({
      where: { id: cartId },
      data: {
        status: 'OPEN',
        meta: {
          ...(cart.meta as object),
          unlockedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      message: 'Carrinho desbloqueado com sucesso',
      cartId,
    });
  } catch (error) {
    console.error('[CART_UNLOCK]', error);
    return NextResponse.json(
      { message: 'Erro ao desbloquear carrinho' },
      { status: 500 }
    );
  }
}
