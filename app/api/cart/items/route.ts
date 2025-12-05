
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { addCartItemSchema } from '@/lib/validation/cart';
import type { Prisma } from '@prisma/client';

/**
 * POST /api/cart/items
 * Adiciona um item ao carrinho
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // Validar dados
    const validation = addCartItemSchema.safeParse(body);
    if (!validation.success) {
      console.error('[CART_ITEMS_POST] Validation error:', JSON.stringify(validation.error.format(), null, 2));
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Buscar ou criar carrinho OPEN do usuário
    // REGRA: Cada usuário pode ter apenas 1 carrinho OPEN (enforced by unique index)
    let cart = await prisma.cart.findFirst({
      where: {
        userId: session.userId,
        status: 'OPEN',
      },
      include: {
        items: true,
      },
    });

    // Se não existir, criar um novo carrinho
    // Usa try-catch para lidar com race condition (unique constraint violation)
    if (!cart) {
      try {
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
      } catch (error: unknown) {
        // Se falhar por unique constraint, outro request criou o carrinho - buscar novamente
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          cart = await prisma.cart.findFirst({
            where: {
              userId: session.userId,
              status: 'OPEN',
            },
            include: {
              items: true,
            },
          });
          if (!cart) {
            throw new Error('Falha ao criar/buscar carrinho');
          }
        } else {
          throw error;
        }
      }
    }

    // Criar item no carrinho
    const item = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        originAddress: data.originAddress as Prisma.InputJsonValue,
        destination: data.destination as Prisma.InputJsonValue,
        volumes: data.volumes as Prisma.InputJsonValue,
        preferences: data.preferences as Prisma.InputJsonValue,
        insuranceValue: data.insuranceValue,
        pickupPoint: (data.pickupPoint || null) as Prisma.InputJsonValue,
        pickupFee: (data.pickupFee || null) as Prisma.InputJsonValue,
        selectedQuote: data.selectedQuote as Prisma.InputJsonValue,
        totals: data.totals as Prisma.InputJsonValue,
        document: (data.document || null) as Prisma.InputJsonValue, // Documento fiscal (NFE/Declaração)
      },
    });

    // Recalcular totals do carrinho
    const updatedCart = await prisma.cart.findFirst({
      where: { id: cart.id },
      include: { items: true },
    });

    if (updatedCart) {
      const cartTotal = updatedCart.items.reduce((sum, item) => {
        const itemTotals = item.totals as { total?: number };
        const itemTotal = itemTotals?.total || 0;
        return sum + Number(itemTotal);
      }, 0);

      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          totals: {
            subtotal: cartTotal,
            total: cartTotal,
            moeda: 'BRL',
          },
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      message: 'Item adicionado ao carrinho',
      item: {
        id: item.id,
        originAddress: item.originAddress,
        destination: item.destination,
        volumes: item.volumes,
        preferences: item.preferences,
        insuranceValue: item.insuranceValue ? Number(item.insuranceValue) : undefined,
        pickupPoint: item.pickupPoint,
        pickupFee: item.pickupFee,
        selectedQuote: item.selectedQuote,
        totals: item.totals,
        document: item.document, // Documento fiscal (NFE/Declaração)
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[CART_ITEMS_POST]', error);
    return NextResponse.json(
      { message: 'Erro ao adicionar item ao carrinho' },
      { status: 500 }
    );
  }
}
