/**
 * GET /api/admin/finance/reports/accounts-payable
 *
 * Relatório consolidado de contas a pagar/pagas.
 * Inclui custos de transportadoras e outras despesas.
 *
 * Parâmetros:
 * - dateStart, dateEnd: Período (obrigatório)
 * - status: 'pending' | 'paid' | 'all' (default: 'all')
 */

import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission, Prisma } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { startOfDayBrasilia, endOfDayBrasilia } from '@/shared/utils/date';

export type PayableType = 'carrier_cost' | 'expense';
export type PayableStatus = 'pending' | 'paid';

export interface PayableItem {
  id: string;
  type: PayableType;
  creditorName: string;
  description: string;
  dueDate: string | null;
  amountCents: number;
  amountReais: number;
  status: PayableStatus;
  referenceCode: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface AccountsPayableResponse {
  period: {
    dateStart: string;
    dateEnd: string;
  };
  statusFilter: string;
  summary: {
    totalItems: number;
    totalAmountCents: number;
    totalAmountReais: number;
    pendingAmountCents: number;
    pendingAmountReais: number;
    paidAmountCents: number;
    paidAmountReais: number;
    byType: Record<PayableType, { count: number; amountCents: number; amountReais: number }>;
  };
  items: PayableItem[];
}


export const GET = withApiHandler<AccountsPayableResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.FINANCEIRO);

  if (!session.permissions.includes(AdminPermission.FINANCEIRO) && !session.isSuperAdmin) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Acesso negado',
      status: 403,
    });
  }

  const searchParams = new URL(req.url).searchParams;
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');
  const statusFilter = searchParams.get('status') || 'all';

  if (!dateStart || !dateEnd) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Período obrigatório (dateStart e dateEnd)',
      status: 400,
    });
  }

  // Usar UTC-3 (Brasília) para filtros de data
  const startDate = startOfDayBrasilia(dateStart);
  const endDate = endOfDayBrasilia(dateEnd);

  // PERFORMANCE: Executar todas as queries em paralelo (independentes)
  const [carrierCosts, expenses] = await Promise.all([
    getCarrierCosts(startDate, endDate, statusFilter),
    getExpenses(startDate, endDate, statusFilter),
  ]);

  const items: PayableItem[] = [
    ...carrierCosts,
    ...expenses,
  ];

  // Ordenar por data de vencimento/criação
  items.sort((a, b) => {
    const dateA = a.dueDate || a.createdAt;
    const dateB = b.dueDate || b.createdAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  // Calcular resumo
  const summary = calculateSummary(items);

  const response: AccountsPayableResponse = {
    period: {
      dateStart: startDate.toISOString(),
      dateEnd: endDate.toISOString(),
    },
    statusFilter,
    summary,
    items,
  };

  return { data: response };
});



async function getCarrierCosts(
  startDate: Date,
  endDate: Date,
  statusFilter: string
): Promise<PayableItem[]> {
  // Labels com status 'issued' ou 'paid' são considerados pagos
  const whereStatus: string[] = [];
  if (statusFilter === 'paid') {
    whereStatus.push('issued', 'paid');
  } else if (statusFilter === 'pending') {
    whereStatus.push('pending');
  } else {
    whereStatus.push('issued', 'paid', 'pending');
  }

  // Buscar labels com seus packages para obter o custo real da transportadora
  const labels = await prisma.label.findMany({
    where: {
      status: { in: whereStatus },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      shipment: {
        select: {
          platformTrackingCode: true,
          destinationCity: true,
          destinationState: true,
          packages: {
            select: {
              carrierQuotePrice: true,
            },
          },
        },
      },
    },
  });

  return labels.map((label): PayableItem => {
    const isPaid = ['issued', 'paid'].includes(label.status);
    // Usar carrierQuotePrice (custo real da transportadora) em vez de priceCents (valor cobrado do cliente)
    // carrierQuotePrice está em reais (Float), converter para centavos
    const totalCarrierCostReais = label.shipment.packages.reduce(
      (sum, pkg) => sum + (pkg.carrierQuotePrice || 0),
      0
    );
    const amountCents = Math.round(totalCarrierCostReais * 100);
    const amountReais = totalCarrierCostReais;

    return {
      id: `carrier_${label.id}`,
      type: 'carrier_cost',
      creditorName: label.carrier,
      description: `Etiqueta ${label.shipment.platformTrackingCode} - ${label.shipment.destinationCity}/${label.shipment.destinationState}`,
      dueDate: null,
      amountCents,
      amountReais,
      status: isPaid ? 'paid' : 'pending',
      referenceCode: label.trackingCode || label.shipment.platformTrackingCode,
      createdAt: label.createdAt.toISOString(),
      paidAt: isPaid ? label.updatedAt.toISOString() : null,
    };
  });
}

async function getExpenses(
  startDate: Date,
  endDate: Date,
  statusFilter: string
): Promise<PayableItem[]> {
  const where: Prisma.ExpenseWhereInput = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (statusFilter === 'paid') {
    where.status = 'PAID';
  } else if (statusFilter === 'pending') {
    where.status = 'PENDING';
  } else {
    where.status = { in: ['PAID', 'PENDING'] };
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return expenses.map((expense): PayableItem => {
    const isPaid = expense.status === 'PAID';

    return {
      id: `expense_${expense.id}`,
      type: 'expense',
      creditorName: expense.supplier || 'Fornecedor não informado',
      description: expense.description,
      dueDate: expense.dueDate?.toISOString() || null,
      amountCents: expense.amountCents,
      amountReais: expense.amountCents / 100,
      status: isPaid ? 'paid' : 'pending',
      referenceCode: expense.reference,
      createdAt: expense.createdAt.toISOString(),
      paidAt: expense.paidAt?.toISOString() || null,
    };
  });
}

function calculateSummary(items: PayableItem[]): AccountsPayableResponse['summary'] {
  const byType: Record<PayableType, { count: number; amountCents: number; amountReais: number }> = {
    carrier_cost: { count: 0, amountCents: 0, amountReais: 0 },
    expense: { count: 0, amountCents: 0, amountReais: 0 },
  };

  let totalAmountCents = 0;
  let pendingAmountCents = 0;
  let paidAmountCents = 0;

  for (const item of items) {
    byType[item.type].count++;
    byType[item.type].amountCents += item.amountCents;
    byType[item.type].amountReais += item.amountReais;

    totalAmountCents += item.amountCents;

    if (item.status === 'paid') {
      paidAmountCents += item.amountCents;
    } else {
      pendingAmountCents += item.amountCents;
    }
  }

  return {
    totalItems: items.length,
    totalAmountCents,
    totalAmountReais: totalAmountCents / 100,
    pendingAmountCents,
    pendingAmountReais: pendingAmountCents / 100,
    paidAmountCents,
    paidAmountReais: paidAmountCents / 100,
    byType,
  };
}
