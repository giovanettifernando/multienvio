/**
 * GET/DELETE /api/admin/clients/[id]/cards
 *
 * Gerencia cartões de um usuário da plataforma (Admin)
 * Nota: Admin não pode adicionar cartões, apenas visualizar e remover
 */


import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Listar cartões (sem dados sensíveis)
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId } = await context.params;

    const cards = await prisma.card.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        brand: true,
        holderName: true,
        last4: true,
        expMonth: true,
        expYear: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('[ADMIN_GET_CARDS]', error);
    return NextResponse.json({ message: 'Erro ao buscar cartões' }, { status: 500 });
  }
}
