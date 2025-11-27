/**
 * GET/POST /api/admin/clients/[id]/recurring-items
 *
 * Gerencia itens recorrentes de um usuário (Admin)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const itemSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  valorUnitario: z.number().min(0, 'Valor deve ser maior ou igual a zero'),
});

// GET - Listar itens recorrentes
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId } = await context.params;

    const items = await prisma.recurringItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[ADMIN_GET_RECURRING_ITEMS]', error);
    return NextResponse.json({ message: 'Erro ao buscar itens recorrentes' }, { status: 500 });
  }
}

// POST - Criar novo item recorrente
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId } = await context.params;
    const body = await request.json();

    const validation = itemSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar se usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }

    const { descricao, valorUnitario } = validation.data;

    const item = await prisma.recurringItem.create({
      data: {
        userId,
        descricao,
        valorUnitario,
      },
    });

    console.log('[ADMIN_CREATE_RECURRING_ITEM]', {
      adminId: authResult.user.id,
      userId,
      itemId: item.id,
    });

    return NextResponse.json({ message: 'Item criado com sucesso', item }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_CREATE_RECURRING_ITEM_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao criar item recorrente' }, { status: 500 });
  }
}
