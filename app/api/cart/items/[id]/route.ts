export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { updateCartItemSchema } from '@/lib/validation/cart';
import type { Prisma } from '@prisma/client';

/**
 * PATCH /api/cart/items/[id]
 * Atualiza um item do carrinho
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id: itemId } = await params;
    const body = await request.json();

    // Validar dados
    const validation = updateCartItemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verificar que o item pertence ao carrinho do usuário
    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
      },
      include: {
        cart: true,
      },
    });

    if (!item || item.cart.userId !== session.userId) {
      return NextResponse.json(
        { message: 'Item não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar apenas os campos fornecidos
    const updateData: Prisma.CartItemUpdateInput = {
      updatedAt: new Date(),
    };

    if (data.originAddress) updateData.originAddress = data.originAddress as Prisma.InputJsonValue;
    if (data.destination) updateData.destination = data.destination as Prisma.InputJsonValue;
    if (data.volumes) updateData.volumes = data.volumes as Prisma.InputJsonValue;
    if (data.preferences) updateData.preferences = data.preferences as Prisma.InputJsonValue;
    if (data.insuranceValue !== undefined) updateData.insuranceValue = data.insuranceValue;
    if (data.pickupPoint !== undefined) updateData.pickupPoint = (data.pickupPoint || null) as Prisma.InputJsonValue;
    if (data.selectedQuote) updateData.selectedQuote = data.selectedQuote as Prisma.InputJsonValue;
    if (data.totals) updateData.totals = data.totals as Prisma.InputJsonValue;

    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Recalcular totals do carrinho
    const cart = await prisma.cart.findFirst({
      where: { id: item.cartId },
      include: { items: true },
    });

    if (cart) {
      const cartTotal = cart.items.reduce((sum, item) => {
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
      message: 'Item atualizado',
      item: {
        id: updatedItem.id,
        originAddress: updatedItem.originAddress,
        destination: updatedItem.destination,
        volumes: updatedItem.volumes,
        preferences: updatedItem.preferences,
        insuranceValue: updatedItem.insuranceValue ? Number(updatedItem.insuranceValue) : undefined,
        pickupPoint: updatedItem.pickupPoint,
        selectedQuote: updatedItem.selectedQuote,
        totals: updatedItem.totals,
        createdAt: updatedItem.createdAt.toISOString(),
        updatedAt: updatedItem.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[CART_ITEM_PATCH]', error);
    return NextResponse.json(
      { message: 'Erro ao atualizar item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cart/items/[id]
 * Remove um item do carrinho
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id: itemId } = await params;

    // Verificar que o item pertence ao carrinho do usuário
    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
      },
      include: {
        cart: true,
      },
    });

    if (!item || item.cart.userId !== session.userId) {
      return NextResponse.json(
        { message: 'Item não encontrado' },
        { status: 404 }
      );
    }

    const cartId = item.cartId;

    // Remover item
    await prisma.cartItem.delete({
      where: { id: itemId },
    });

    // Recalcular totals do carrinho
    const cart = await prisma.cart.findFirst({
      where: { id: cartId },
      include: { items: true },
    });

    if (cart) {
      const cartTotal = cart.items.reduce((sum, item) => {
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
      message: 'Item removido do carrinho',
    });
  } catch (error) {
    console.error('[CART_ITEM_DELETE]', error);
    return NextResponse.json(
      { message: 'Erro ao remover item' },
      { status: 500 }
    );
  }
}
