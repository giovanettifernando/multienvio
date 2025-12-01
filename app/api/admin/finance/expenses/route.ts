/**
 * GET /api/admin/finance/expenses - Lista despesas com filtros
 * POST /api/admin/finance/expenses - Cria nova despesa
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission, ExpenseType, ExpenseCategory, ExpenseStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { persistExpenseReceipt } from '@/lib/storage/expense-receipts';


export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
    const type = searchParams.get('type') as ExpenseType | null;
    const category = searchParams.get('category') as ExpenseCategory | null;
    const status = searchParams.get('status') as ExpenseStatus | null;
    const q = searchParams.get('q');

    const where: Prisma.ExpenseWhereInput = {};

    // Filtro por período
    if (dateStart || dateEnd) {
      where.createdAt = {};
      if (dateStart) where.createdAt.gte = new Date(dateStart);
      if (dateEnd) where.createdAt.lte = new Date(dateEnd);
    }

    // Filtro por tipo
    if (type) {
      where.type = type;
    }

    // Filtro por categoria
    if (category) {
      where.category = category;
    }

    // Filtro por status
    if (status) {
      where.status = status;
    }

    // Busca textual
    if (q) {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { supplier: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.expense.count({ where }),
    ]);

    // Calcular resumo
    const summary = await prisma.expense.aggregate({
      where,
      _sum: {
        amountCents: true,
      },
      _count: true,
    });

    const summaryByStatus = await prisma.expense.groupBy({
      by: ['status'],
      where,
      _sum: {
        amountCents: true,
      },
      _count: true,
    });

    return NextResponse.json({
      items: expenses.map((e) => ({
        ...e,
        amountReais: e.amountCents / 100,
      })),
      page,
      pageSize,
      total,
      summary: {
        totalAmountCents: summary._sum.amountCents || 0,
        totalAmountReais: (summary._sum.amountCents || 0) / 100,
        totalCount: summary._count,
        byStatus: summaryByStatus.reduce(
          (acc, s) => {
            acc[s.status] = {
              count: s._count,
              amountCents: s._sum.amountCents || 0,
              amountReais: (s._sum.amountCents || 0) / 100,
            };
            return acc;
          },
          {} as Record<string, { count: number; amountCents: number; amountReais: number }>
        ),
      },
    });
  } catch (error) {
    console.error('[EXPENSES_LIST] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao listar despesas' },
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
    const formData = await request.formData();

    const type = formData.get('type') as ExpenseType;
    const category = formData.get('category') as ExpenseCategory;
    const description = formData.get('description') as string;
    const amountCents = parseInt(formData.get('amountCents') as string, 10);
    const status = (formData.get('status') as ExpenseStatus) || 'PENDING';
    const dueDate = formData.get('dueDate') as string | null;
    const paidAt = formData.get('paidAt') as string | null;
    const reference = formData.get('reference') as string | null;
    const supplier = formData.get('supplier') as string | null;
    const notes = formData.get('notes') as string | null;
    const dreAccountCode = formData.get('dreAccountCode') as string | null;
    const isRecurring = formData.get('isRecurring') === 'true';
    const recurringMonths = formData.get('recurringMonths')
      ? parseInt(formData.get('recurringMonths') as string, 10)
      : null;
    const receipt = formData.get('receipt') as File | null;

    // Validação
    if (!type || !category || !description || !amountCents) {
      return NextResponse.json(
        { message: 'Campos obrigatórios: type, category, description, amountCents' },
        { status: 400 }
      );
    }

    let receiptUrl: string | null = null;
    let receiptFileName: string | null = null;
    let receiptUploadedAt: Date | null = null;

    // Upload do comprovante
    if (receipt && receipt.size > 0) {
      const persisted = await persistExpenseReceipt(receipt);
      receiptUrl = persisted.publicUrl;
      receiptFileName = persisted.originalName;
      receiptUploadedAt = new Date();
    }

    const expense = await prisma.expense.create({
      data: {
        type,
        category,
        description,
        amountCents,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
        paidAt: paidAt ? new Date(paidAt) : null,
        reference: reference || null,
        supplier: supplier || null,
        notes: notes || null,
        dreAccountCode: dreAccountCode || null,
        isRecurring,
        recurringMonths,
        receiptUrl,
        receiptFileName,
        receiptUploadedAt,
        createdBy: session.staffId,
      },
    });

    return NextResponse.json({
      ok: true,
      expense: {
        ...expense,
        amountReais: expense.amountCents / 100,
      },
    });
  } catch (error) {
    console.error('[EXPENSES_CREATE] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao criar despesa' },
      { status: 500 }
    );
  }
}
