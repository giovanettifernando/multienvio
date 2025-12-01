
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * GET /api/carrinho (alias para /api/cart)
 * Retorna o carrinho OPEN do usuário logado com seus itens
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    // Buscar carrinho OPEN do usuário
    let cart = await prisma.cart.findFirst({
      where: {
        userId: session.userId,
        status: 'OPEN',
      },
      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Se não existir, criar um novo carrinho vazio
    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: session.userId,
          status: 'OPEN',
          totals: { total: 0, moeda: 'BRL' },
        },
        include: {
          items: true,
        },
      });
    }

    return NextResponse.json({
      cart: {
        id: cart.id,
        status: cart.status,
        totals: cart.totals,
        meta: cart.meta,
        createdAt: cart.createdAt.toISOString(),
        updatedAt: cart.updatedAt.toISOString(),
        items: cart.items.map((item) => ({
          id: item.id,
          originAddress: item.originAddress,
          destination: item.destination,
          volumes: item.volumes,
          preferences: item.preferences,
          insuranceValue: item.insuranceValue ? Number(item.insuranceValue) : undefined,
          pickupPoint: item.pickupPoint,
          selectedQuote: item.selectedQuote,
          totals: item.totals,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('[CART_GET]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar carrinho' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/carrinho (alias para /api/cart)
 * Limpa o carrinho do usuário (remove todos os itens)
 * Agora aceita carrinho OPEN ou LOCKED e reseta para OPEN
 */
export async function DELETE() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    // Buscar carrinho OPEN ou LOCKED do usuário
    const cart = await prisma.cart.findFirst({
      where: {
        userId: session.userId,
        status: { in: ['OPEN', 'LOCKED'] },
      },
    });

    if (!cart) {
      return NextResponse.json({ message: 'Carrinho não encontrado' }, { status: 404 });
    }

    // Remover todos os itens
    await prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
      },
    });

    // Resetar carrinho: limpar totals, voltar para OPEN, limpar meta de checkout
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        status: 'OPEN',
        totals: { total: 0, moeda: 'BRL' },
        meta: {}, // Limpar fingerprint e histórico de checkout
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Carrinho limpo com sucesso',
      ok: true,
    });
  } catch (error) {
    console.error('[CART_DELETE]', error);
    return NextResponse.json(
      { message: 'Erro ao limpar carrinho' },
      { status: 500 }
    );
  }
}
