/**
 * GET /api/admin/finance/expense-templates - Lista templates de despesas
 * POST /api/admin/finance/expense-templates - Cria novo template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission, ExpenseType, ExpenseCategory } from '@prisma/client';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as ExpenseCategory | null;

    const templates = await prisma.expenseTemplate.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
      },
      orderBy: [
        { usageCount: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      items: templates.map((t) => ({
        ...t,
        defaultAmountReais: t.defaultAmount ? t.defaultAmount / 100 : null,
      })),
    });
  } catch (error) {
    console.error('[EXPENSE_TEMPLATES_LIST] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao listar templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const body = await request.json();
    const { name, type, category, supplier, defaultAmountCents } = body;

    if (!name || !type || !category) {
      return NextResponse.json(
        { message: 'Campos obrigatórios: name, type, category' },
        { status: 400 }
      );
    }

    // Verificar se já existe um template com esse nome na categoria
    const existing = await prisma.expenseTemplate.findUnique({
      where: {
        name_category: {
          name,
          category,
        },
      },
    });

    if (existing) {
      // Reativar se estava inativo
      if (!existing.isActive) {
        const updated = await prisma.expenseTemplate.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            type: type as ExpenseType,
            supplier: supplier || null,
            defaultAmount: defaultAmountCents || null,
          },
        });
        return NextResponse.json({
          ok: true,
          template: {
            ...updated,
            defaultAmountReais: updated.defaultAmount ? updated.defaultAmount / 100 : null,
          },
        });
      }
      return NextResponse.json(
        { message: 'Já existe um template com esse nome nesta categoria' },
        { status: 400 }
      );
    }

    const template = await prisma.expenseTemplate.create({
      data: {
        name,
        type: type as ExpenseType,
        category: category as ExpenseCategory,
        supplier: supplier || null,
        defaultAmount: defaultAmountCents || null,
        createdBy: session.staffId,
      },
    });

    return NextResponse.json({
      ok: true,
      template: {
        ...template,
        defaultAmountReais: template.defaultAmount ? template.defaultAmount / 100 : null,
      },
    });
  } catch (error) {
    console.error('[EXPENSE_TEMPLATES_CREATE] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao criar template' },
      { status: 500 }
    );
  }
}
