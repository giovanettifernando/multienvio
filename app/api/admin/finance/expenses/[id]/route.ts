/**
 * GET /api/admin/finance/expenses/[id] - Busca despesa por ID
 * PUT /api/admin/finance/expenses/[id] - Atualiza despesa
 * DELETE /api/admin/finance/expenses/[id] - Remove despesa
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission, ExpenseType, ExpenseCategory, ExpenseStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { persistExpenseReceipt, deleteExpenseReceipt } from '@/lib/storage/expense-receipts';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const { id } = await context.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return NextResponse.json({ message: 'Despesa não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      ...expense,
      amountReais: expense.amountCents / 100,
    });
  } catch (error) {
    console.error('[EXPENSE_GET] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar despesa' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const { id } = await context.params;

    const existing = await prisma.expense.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Despesa não encontrada' }, { status: 404 });
    }

    const formData = await request.formData();

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

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

    return NextResponse.json({
      ok: true,
      expense: {
        ...expense,
        amountReais: expense.amountCents / 100,
      },
    });
  } catch (error) {
    console.error('[EXPENSE_UPDATE] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao atualizar despesa' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const { id } = await context.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return NextResponse.json({ message: 'Despesa não encontrada' }, { status: 404 });
    }

    // Remover comprovante se existir
    if (expense.receiptUrl) {
      await deleteExpenseReceipt(expense.receiptUrl);
    }

    await prisma.expense.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[EXPENSE_DELETE] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao remover despesa' },
      { status: 500 }
    );
  }
}
