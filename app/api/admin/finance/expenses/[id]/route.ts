/**
 * GET /api/admin/finance/expenses/[id] - Busca despesa por ID
 * PUT /api/admin/finance/expenses/[id] - Atualiza despesa
 * DELETE /api/admin/finance/expenses/[id] - Remove despesa
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { AdminPermission, ExpenseType, ExpenseCategory, ExpenseStatus, Prisma } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { persistExpenseReceipt, deleteExpenseReceipt } from '@/platform/storage/expense-receipts';

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

interface GetExpenseResponse {
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

export const GET = withApiHandler<GetExpenseResponse, { id: string }>(async ({ req, params }) => {
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

  const { id } = params;

  const expense = await prisma.expense.findUnique({
    where: { id },
  });

  if (!expense) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Despesa não encontrada',
      status: 404,
    });
  }

  return {
    data: {
      ...expense,
      amountReais: expense.amountCents / 100,
    },
  };
});

interface UpdateExpenseResponse {
  ok: boolean;
  expense: ExpenseWithAmountReais;
}

export const PUT = withApiHandler<UpdateExpenseResponse, { id: string }>(async ({ req, params }) => {
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

  const { id } = params;

  const existing = await prisma.expense.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Despesa não encontrada',
      status: 404,
    });
  }

  const formData = await req.formData();

  const type = formData.get('type') as ExpenseType | null;
  const category = formData.get('category') as ExpenseCategory | null;
  const description = formData.get('description') as string | null;
  const amountCents = formData.get('amountCents')
    ? parseInt(formData.get('amountCents') as string, 10)
    : null;
  const status = formData.get('status') as ExpenseStatus | null;
  const dueDate = formData.get('dueDate') as string | null;
  const paidAt = formData.get('paidAt') as string | null;
  const reference = formData.get('reference') as string | null;
  const supplier = formData.get('supplier') as string | null;
  const notes = formData.get('notes') as string | null;
  const dreAccountCode = formData.get('dreAccountCode') as string | null;
  const isRecurring = formData.has('isRecurring')
    ? formData.get('isRecurring') === 'true'
    : undefined;
  const recurringMonths = formData.has('recurringMonths')
    ? formData.get('recurringMonths')
      ? parseInt(formData.get('recurringMonths') as string, 10)
      : null
    : undefined;
  const receipt = formData.get('receipt') as File | null;
  const removeReceipt = formData.get('removeReceipt') === 'true';

  const updateData: Prisma.ExpenseUpdateInput = {};

  if (type) updateData.type = type;
  if (category) updateData.category = category;
  if (description) updateData.description = description;
  if (amountCents !== null) updateData.amountCents = amountCents;
  if (status) updateData.status = status;
  if (formData.has('dueDate')) {
    updateData.dueDate = dueDate ? new Date(dueDate) : null;
  }
  if (formData.has('paidAt')) {
    updateData.paidAt = paidAt ? new Date(paidAt) : null;
  }
  if (formData.has('reference')) updateData.reference = reference || null;
  if (formData.has('supplier')) updateData.supplier = supplier || null;
  if (formData.has('notes')) updateData.notes = notes || null;
  if (formData.has('dreAccountCode')) updateData.dreAccountCode = dreAccountCode || null;
  if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
  if (recurringMonths !== undefined) updateData.recurringMonths = recurringMonths;

  // Se status mudou para PAID, registrar data de pagamento
  if (status === 'PAID' && existing.status !== 'PAID' && !updateData.paidAt) {
    updateData.paidAt = new Date();
  }

  // Upload de novo comprovante
  if (receipt && receipt.size > 0) {
    // Remover comprovante antigo
    if (existing.receiptUrl) {
      await deleteExpenseReceipt(existing.receiptUrl);
    }

    const persisted = await persistExpenseReceipt(receipt);
    updateData.receiptUrl = persisted.publicUrl;
    updateData.receiptFileName = persisted.originalName;
    updateData.receiptUploadedAt = new Date();
  } else if (removeReceipt && existing.receiptUrl) {
    // Remover comprovante
    await deleteExpenseReceipt(existing.receiptUrl);
    updateData.receiptUrl = null;
    updateData.receiptFileName = null;
    updateData.receiptUploadedAt = null;
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: updateData,
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

interface DeleteExpenseResponse {
  ok: boolean;
}

export const DELETE = withApiHandler<DeleteExpenseResponse, { id: string }>(async ({ req, params }) => {
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

  const { id } = params;

  const expense = await prisma.expense.findUnique({
    where: { id },
  });

  if (!expense) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Despesa não encontrada',
      status: 404,
    });
  }

  // Remover comprovante se existir
  if (expense.receiptUrl) {
    await deleteExpenseReceipt(expense.receiptUrl);
  }

  await prisma.expense.delete({
    where: { id },
  });

  return {
    data: { ok: true },
  };
});
