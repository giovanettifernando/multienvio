/**
 * DELETE /api/admin/finance/expense-templates/[id] - Desativa template
 * PATCH /api/admin/finance/expense-templates/[id] - Incrementa uso
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

// Incrementar contador de uso
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const { id } = await context.params;

    await prisma.expenseTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[EXPENSE_TEMPLATE_USE] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao registrar uso do template' },
      { status: 500 }
    );
  }
}

// Desativar template (soft delete)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const { id } = await context.params;

    await prisma.expenseTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[EXPENSE_TEMPLATE_DELETE] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao desativar template' },
      { status: 500 }
    );
  }
}
