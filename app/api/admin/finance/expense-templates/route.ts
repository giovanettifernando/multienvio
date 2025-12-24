/**
 * GET /api/admin/finance/expense-templates - Lista templates de despesas
 * POST /api/admin/finance/expense-templates - Cria novo template
 */

import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission, ExpenseType, ExpenseCategory } from '@prisma/client';
import { prisma } from '@/platform/db/db';

interface ExpenseTemplateWithAmountReais {
  id: string;
  name: string;
  type: ExpenseType;
  category: ExpenseCategory;
  supplier: string | null;
  defaultAmount: number | null;
  defaultAmountReais: number | null;
  isActive: boolean;
  usageCount: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface GetExpenseTemplatesResponse {
  items: ExpenseTemplateWithAmountReais[];
}

export const GET = withApiHandler<GetExpenseTemplatesResponse>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const searchParams = req.nextUrl.searchParams;
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

  return {
    data: {
      items: templates.map((t) => ({
        ...t,
        defaultAmountReais: t.defaultAmount ? t.defaultAmount / 100 : null,
      })),
    },
  };
});

const createExpenseTemplateSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(ExpenseType),
  category: z.nativeEnum(ExpenseCategory),
  supplier: z.string().optional(),
  defaultAmountCents: z.number().int().positive().optional(),
});

interface CreateExpenseTemplateResponse {
  ok: boolean;
  template: ExpenseTemplateWithAmountReais;
}

export const POST = withApiHandler<CreateExpenseTemplateResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const body = await req.json();

  const parsed = createExpenseTemplateSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { name, type, category, supplier, defaultAmountCents } = parsed.data;

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
          type,
          supplier: supplier || null,
          defaultAmount: defaultAmountCents || null,
        },
      });
      return {
        data: {
          ok: true,
          template: {
            ...updated,
            defaultAmountReais: updated.defaultAmount ? updated.defaultAmount / 100 : null,
          },
        },
      };
    }
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Já existe um template com esse nome nesta categoria',
      status: 400,
    });
  }

  const template = await prisma.expenseTemplate.create({
    data: {
      name,
      type,
      category,
      supplier: supplier || null,
      defaultAmount: defaultAmountCents || null,
      createdBy: session.staffId,
    },
  });

  return {
    data: {
      ok: true,
      template: {
        ...template,
        defaultAmountReais: template.defaultAmount ? template.defaultAmount / 100 : null,
      },
    },
  };
});
