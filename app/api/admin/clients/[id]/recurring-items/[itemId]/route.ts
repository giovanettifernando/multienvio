/**
 * PUT/DELETE /api/admin/clients/[id]/recurring-items/[itemId]
 *
 * Atualiza ou remove item recorrente de um usuário (Admin)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>;
}

const itemSchema = z.object({
  descricao: z.string().min(1).optional(),
  valorUnitario: z.number().min(0).optional(),
});

// PUT - Atualizar item recorrente
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId, itemId } = await context.params;
    const body = await request.json();

    const validation = itemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar se item existe e pertence ao usuário
    const existing = await prisma.recurringItem.findFirst({
      where: { id: itemId, userId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Item não encontrado' }, { status: 404 });
    }

    const { descricao, valorUnitario } = validation.data;

    const item = await prisma.recurringItem.update({
      where: { id: itemId },
      data: {
        ...(descricao !== undefined && { descricao }),
        ...(valorUnitario !== undefined && { valorUnitario }),
      },
    });

    console.log('[ADMIN_UPDATE_RECURRING_ITEM]', {
      adminId: authResult.user.id,
      userId,
      itemId,
    });

    return NextResponse.json({ message: 'Item atualizado com sucesso', item });
  } catch (error) {
    console.error('[ADMIN_UPDATE_RECURRING_ITEM_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao atualizar item' }, { status: 500 });
  }
}

// DELETE - Remover item recorrente
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId, itemId } = await context.params;

    // Verificar se item existe e pertence ao usuário
    const existing = await prisma.recurringItem.findFirst({
      where: { id: itemId, userId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Item não encontrado' }, { status: 404 });
    }

    await prisma.recurringItem.delete({
      where: { id: itemId },
    });

    console.log('[ADMIN_DELETE_RECURRING_ITEM]', {
      adminId: authResult.user.id,
      userId,
      itemId,
    });

    return NextResponse.json({ message: 'Item removido com sucesso' });
  } catch (error) {
    console.error('[ADMIN_DELETE_RECURRING_ITEM_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao remover item' }, { status: 500 });
  }
}
