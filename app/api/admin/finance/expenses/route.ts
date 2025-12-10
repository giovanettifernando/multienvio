/**
 * GET /api/admin/finance/expenses - Lista despesas com filtros
 * POST /api/admin/finance/expenses - Cria nova despesa
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, ExpenseType, ExpenseCategory, ExpenseStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { persistExpenseReceipt } from '@/lib/storage/expense-receipts';

interface ExpenseWithAmountReais {
  id: string;
  type: ExpenseType;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  amountReais: number;
  status: ExpenseStatus;
  dueDate: Date | null;
  paidAt: Date | null;
  reference: string | null;
  supplier: string | null;
  notes: string | null;
  dreAccountCode: string | null;
  isRecurring: boolean;
  recurringMonths: number | null;
  receiptUrl: string | null;
  receiptFileName: string | null;
  receiptUploadedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ExpenseSummaryByStatus {
  count: number;
  amountCents: number;
  amountReais: number;
}

interface ExpenseSummary {
  totalAmountCents: number;
  totalAmountReais: number;
  totalCount: number;
  byStatus: Record<string, ExpenseSummaryByStatus>;
}

interface GetExpensesResponse {
  items: ExpenseWithAmountReais[];
  page: number;
  pageSize: number;
  total: number;
  summary: ExpenseSummary;
}

export const GET = withApiHandler<GetExpensesResponse>(async ({ req }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  if (!session.permissions.includes(AdminPermission.FINANCEIRO)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para acessar este recurso',
      status: 403,
    });
  }

  const searchParams = req.nextUrl.searchParams;
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

  return {
    data: {
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
    },
  };
});

interface CreateExpenseResponse {
  ok: boolean;
  expense: ExpenseWithAmountReais;
}

export const POST = withApiHandler<CreateExpenseResponse>(async ({ req }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  if (!session.permissions.includes(AdminPermission.FINANCEIRO)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para acessar este recurso',
      status: 403,
    });
  }

  const formData = await req.formData();

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
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Campos obrigatórios: type, category, description, amountCents',
      status: 400,
    });
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

  return {
    data: {
      ok: true,
      expense: {
        ...expense,
        amountReais: expense.amountCents / 100,
      },
    },
  };
});
