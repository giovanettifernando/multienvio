/**
 * PUT/DELETE /api/admin/clients/[id]/cards/[cardId]
 *
 * Gerencia cartão específico de um usuário (Admin)
 * Apenas permite definir como default ou remover
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string; cardId: string }>;
}

const updateCardSchema = z.object({
  isDefault: z.boolean(),
});

// PUT - Definir cartão como default
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId, cardId } = await context.params;
    const body = await request.json();

    const validation = updateCardSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar se cartão existe e pertence ao usuário
    const existing = await prisma.card.findFirst({
      where: { id: cardId, userId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Cartão não encontrado' }, { status: 404 });
    }

    const { isDefault } = validation.data;

    if (isDefault) {
      // Remover default de outros cartões
      await prisma.card.updateMany({
        where: { userId, isDefault: true, id: { not: cardId } },
        data: { isDefault: false },
      });
    }

    const card = await prisma.card.update({
      where: { id: cardId },
      data: { isDefault },
      select: {
        id: true,
        brand: true,
        holderName: true,
        last4: true,
        expMonth: true,
        expYear: true,
        isDefault: true,
      },
    });

    console.log('[ADMIN_UPDATE_CARD]', {
      adminId: authResult.user.id,
      userId,
      cardId,
      isDefault,
    });

    return NextResponse.json({ message: 'Cartão atualizado com sucesso', card });
  } catch (error) {
    console.error('[ADMIN_UPDATE_CARD_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao atualizar cartão' }, { status: 500 });
  }
}

// DELETE - Remover cartão
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId, cardId } = await context.params;

    // Verificar se cartão existe e pertence ao usuário
    const existing = await prisma.card.findFirst({
      where: { id: cardId, userId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Cartão não encontrado' }, { status: 404 });
    }

    await prisma.card.delete({
      where: { id: cardId },
    });

    console.log('[ADMIN_DELETE_CARD]', {
      adminId: authResult.user.id,
      userId,
      cardId,
    });

    return NextResponse.json({ message: 'Cartão removido com sucesso' });
  } catch (error) {
    console.error('[ADMIN_DELETE_CARD_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao remover cartão' }, { status: 500 });
  }
}
