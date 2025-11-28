/**
 * GET /api/admin/finance/reports/accounts-payable
 *
 * Relatório consolidado de contas a pagar/pagas.
 * Inclui: comissões de coletores, comissões de pontos de coleta,
 * custos de transportadoras e outras despesas.
 *
 * Parâmetros:
 * - dateStart, dateEnd: Período (obrigatório)
 * - status: 'pending' | 'paid' | 'all' (default: 'all')
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export type PayableType = 'collector_commission' | 'pickup_point_commission' | 'carrier_cost' | 'expense';
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

// Status de PickupRequest que indicam coleta realizada (pago)
const COMPLETED_PICKUP_STATUSES = ['COLLECTED', 'COMPLETED'];
// Status de Reception que indicam recepção realizada (pago)
const COMPLETED_RECEPTION_STATUSES = ['RECEIVED', 'PROCESSED', 'ISSUE_REPORTED'];

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
    const statusFilter = searchParams.get('status') || 'all';

    if (!dateStart || !dateEnd) {
      return NextResponse.json(
        { message: 'Período obrigatório (dateStart e dateEnd)' },
        { status: 400 }
      );
    }

    const startDate = new Date(dateStart);
    const endDate = new Date(dateEnd);
    // Ajustar para fim do dia
    endDate.setHours(23, 59, 59, 999);

    const items: PayableItem[] = [];

    // 1. Comissões de coletores (PickupRequest -> pickupFee)
    const collectorCommissions = await getCollectorCommissions(startDate, endDate, statusFilter);
    items.push(...collectorCommissions);

    // 2. Comissões de pontos de coleta (Reception -> commissionCents)
    const pickupPointCommissions = await getPickupPointCommissions(startDate, endDate, statusFilter);
    items.push(...pickupPointCommissions);

    // 3. Custos de transportadoras (Labels -> priceCents)
    const carrierCosts = await getCarrierCosts(startDate, endDate, statusFilter);
    items.push(...carrierCosts);

    // 4. Outras despesas (Expense)
    const expenses = await getExpenses(startDate, endDate, statusFilter);
    items.push(...expenses);

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

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ACCOUNTS_PAYABLE] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao gerar relatório de contas a pagar' },
      { status: 500 }
    );
  }
}

async function getCollectorCommissions(
  startDate: Date,
  endDate: Date,
  statusFilter: string
): Promise<PayableItem[]> {
  const whereStatus: string[] = [];
  if (statusFilter === 'paid') {
    whereStatus.push(...COMPLETED_PICKUP_STATUSES);
  } else if (statusFilter === 'pending') {
    whereStatus.push('PENDING', 'SCHEDULED');
  } else {
    whereStatus.push(...COMPLETED_PICKUP_STATUSES, 'PENDING', 'SCHEDULED');
  }

  const pickupRequests = await prisma.pickupRequest.findMany({
    where: {
      collectorId: { not: null },
      status: { in: whereStatus },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      collector: {
        select: {
          id: true,
          pfNome: true,
          pjRazaoSocial: true,
        },
      },
      shipment: {
        select: {
          id: true,
          platformTrackingCode: true,
          pickupFee: true,
          destinationCity: true,
          destinationState: true,
        },
      },
    },
  });

  return pickupRequests
    .filter(pr => pr.shipment.pickupFee && pr.shipment.pickupFee > 0)
    .map((pr): PayableItem => {
      const isPaid = COMPLETED_PICKUP_STATUSES.includes(pr.status);
      const amountReais = pr.shipment.pickupFee || 0;
      const amountCents = Math.round(amountReais * 100);

      return {
        id: `collector_${pr.id}`,
        type: 'collector_commission',
        creditorName: pr.collector?.pjRazaoSocial || pr.collector?.pfNome || 'Coletor',
        description: `Coleta ${pr.shipment.platformTrackingCode} - ${pr.shipment.destinationCity}/${pr.shipment.destinationState}`,
        dueDate: null, // Coletas não têm data de vencimento definida
        amountCents,
        amountReais,
        status: isPaid ? 'paid' : 'pending',
        referenceCode: pr.shipment.platformTrackingCode,
        createdAt: pr.createdAt.toISOString(),
        paidAt: isPaid && pr.collectedAt ? pr.collectedAt.toISOString() : null,
      };
    });
}

async function getPickupPointCommissions(
  startDate: Date,
  endDate: Date,
  statusFilter: string
): Promise<PayableItem[]> {
  const whereStatus: string[] = [];
  if (statusFilter === 'paid') {
    whereStatus.push(...COMPLETED_RECEPTION_STATUSES);
  } else if (statusFilter === 'pending') {
    whereStatus.push('PENDING');
  } else {
    whereStatus.push(...COMPLETED_RECEPTION_STATUSES, 'PENDING');
  }

  const receptions = await prisma.reception.findMany({
    where: {
      status: { in: whereStatus as never[] },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      commissionCents: { gt: 0 },
    },
    include: {
      pickupPoint: {
        select: {
          id: true,
          nomeFantasia: true,
          razaoSocial: true,
        },
      },
    },
  });

  return receptions.map((reception): PayableItem => {
    const isPaid = COMPLETED_RECEPTION_STATUSES.includes(reception.status);
    const amountCents = reception.commissionCents;
    const amountReais = amountCents / 100;

    return {
      id: `pickup_point_${reception.id}`,
      type: 'pickup_point_commission',
      creditorName: reception.pickupPoint.nomeFantasia || reception.pickupPoint.razaoSocial || 'Ponto de Coleta',
      description: `Recepção ${reception.trackingCode} - ${reception.senderName}`,
      dueDate: null,
      amountCents,
      amountReais,
      status: isPaid ? 'paid' : 'pending',
      referenceCode: reception.trackingCode,
      createdAt: reception.createdAt.toISOString(),
      paidAt: isPaid && reception.processedAt ? reception.processedAt.toISOString() : null,
    };
  });
}

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
        },
      },
    },
  });

  return labels.map((label): PayableItem => {
    const isPaid = ['issued', 'paid'].includes(label.status);
    const amountCents = label.priceCents;
    const amountReais = amountCents / 100;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
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
    collector_commission: { count: 0, amountCents: 0, amountReais: 0 },
    pickup_point_commission: { count: 0, amountCents: 0, amountReais: 0 },
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
