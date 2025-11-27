/**
 * API routes for /api/admin/clients/[id]
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    // Mock: apenas retorna sucesso
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ADMIN_UPDATE_CLIENT]', error);
    return NextResponse.json({ message: 'Erro ao atualizar cliente' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId } = await context.params;

    // Verificar se usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Excluir usuário e dados relacionados (cascade configurado no Prisma)
    await prisma.user.delete({
      where: { id: userId },
    });

    console.log('[ADMIN_DELETE_USER]', {
      adminId: authResult.user.id,
      adminEmail: authResult.user.email,
      deletedUserId: userId,
      deletedUserEmail: user.email,
    });

    return NextResponse.json({
      ok: true,
      message: 'Conta excluída com sucesso',
    });
  } catch (error) {
    console.error('[ADMIN_DELETE_USER_ERROR]', error);
    return NextResponse.json(
      { message: 'Erro ao excluir conta' },
      { status: 500 }
    );
  }
}
