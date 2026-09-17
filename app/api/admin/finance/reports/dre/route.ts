/**
 * GET /api/admin/finance/reports/dre - Retorna dados do DRE
 */

import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { DRE_CHART_OF_ACCOUNTS, CALCULATED_TOTALS } from '@/modules/admin/application/finance/dre';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

// Mapeamento padrão de categorias de despesa para contas DRE
const EXPENSE_CATEGORY_TO_DRE: Record<string, string> = {
  INFRAESTRUTURA: '6.1.01',
  SOFTWARE: '6.2.02',
  GATEWAY: '3.3.01',
  MARKETING: '4.2.01',
  PESSOAL: '5.1.01',
  ADMINISTRATIVO: '7.1.01',
  LOGISTICA: '5.2.01',
  IMPOSTOS: '2.1.01',
  OUTROS: '7.5.02',
};

interface DREMonthData {
  month: number;
  year: number;
  values: Record<string, number>;
}

interface DREResponse {
  year: number;
  startMonth: number;
  endMonth: number;
  months: DREMonthData[];
  accounts: typeof DRE_CHART_OF_ACCOUNTS;
}

export const GET = withApiHandler<DREResponse>(async ({ req }) => {
  const session = await requireAdminSession(req, AdminPermission.FINANCEIRO);

  if (!session.permissions.includes(AdminPermission.FINANCEIRO) && !session.isSuperAdmin) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Acesso negado',
      status: 403,
    });
  }

  const searchParams = new URL(req.url).searchParams;
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);
  const startMonth = parseInt(searchParams.get('startMonth') || '1', 10);
  const endMonth = parseInt(searchParams.get('endMonth') || '12', 10);

  // Validação
  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Mês inválido. Use valores entre 1 e 12.',
      status: 400,
    });
  }
  if (startMonth > endMonth) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Mês inicial não pode ser maior que mês final.',
      status: 400,
    });
  }

  // Inicializar dados dos meses usando Array.from (mais eficiente)
  const monthsData: Array<{ month: number; year: number; values: Record<string, number> }> =
    Array.from({ length: endMonth - startMonth + 1 }, (_, i) => ({
      month: startMonth + i,
      year,
      values: {},
    }));

  // OTIMIZAÇÃO: Criar Map para lookup O(1) por mês
  const monthsMap = new Map(monthsData.map(m => [m.month, m]));

  // 1. Buscar receitas de comissões de envios postados (usando postedAt como competência)
  const startDate = new Date(year, startMonth - 1, 1);
  const endDate = new Date(year, endMonth, 0, 23, 59, 59, 999);

  // Status que indicam que o shipment foi efetivamente processado
  const validStatuses = [
    'POSTED',
    'IN_TRANSIT',
    'IN_TRANSIT_TO_CARRIER_HUB',
    'IN_TRANSIT_TO_DESTINATION',
    'IN_TRANSFER',
    'AT_DESTINATION_HUB',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'DELIVERED_AT_DESTINATION_HUB',
    'RECEIVED_AT_ORIGIN_HUB',
    'COLLECTED_FROM_SENDER',
    'COLLECTED_FROM_POINT',
  ];

  // Buscar shipments postados no período (competência = postedAt)
  const shipments = await prisma.shipment.findMany({
    where: {
      postedAt: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        in: validStatuses,
      },
    },
    select: {
      postedAt: true,
      platformShippingCommissionCents: true,
    },
  });

  // Agrupar receitas por mês usando postedAt como competência
  for (const shipment of shipments) {
    if (!shipment.postedAt) continue;
    const month = shipment.postedAt.getMonth() + 1;
    const monthData = monthsMap.get(month);
    if (monthData) {
      // 1.1.01 - Comissão sobre frete por envio
      monthData.values['1.1.01'] = (monthData.values['1.1.01'] || 0) +
        (shipment.platformShippingCommissionCents || 0);
    }
  }

  // 2. Buscar despesas agrupadas por mês e conta DRE
  const expenses = await prisma.expense.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        not: 'CANCELED',
      },
    },
    select: {
      amountCents: true,
      category: true,
      dreAccountCode: true,
      createdAt: true,
    },
  });

  // Agrupar despesas por mês e conta DRE - OTIMIZADO com Map (O(1) lookup)
  for (const expense of expenses) {
    const month = expense.createdAt.getMonth() + 1;
    const monthData = monthsMap.get(month);
    if (monthData) {
      // Usar dreAccountCode se definido, senão usar mapeamento padrão
      const accountCode = expense.dreAccountCode ||
        EXPENSE_CATEGORY_TO_DRE[expense.category] ||
        '7.5.02';

      monthData.values[accountCode] = (monthData.values[accountCode] || 0) +
        expense.amountCents;
    }
  }

  // 3. Calcular totais de grupos e subgrupos
  for (const monthData of monthsData) {
    // Calcular totais de subgrupos (nível 2)
    for (const account of DRE_CHART_OF_ACCOUNTS) {
      if (account.level === 2 && account.type === 'subgroup') {
        const subgroupTotal = Object.entries(monthData.values)
          .filter(([code]) => code.startsWith(account.code + '.'))
          .reduce((sum, [, value]) => sum + value, 0);
        if (subgroupTotal !== 0) {
          monthData.values[account.code] = subgroupTotal;
        }
      }
    }

    // Calcular totais de grupos (nível 1)
    for (const account of DRE_CHART_OF_ACCOUNTS) {
      if (account.level === 1 && account.type === 'group' && !account.isTotal) {
        const groupTotal = Object.entries(monthData.values)
          .filter(([code]) => {
            const prefix = account.code.split('.')[0] + '.';
            return code.startsWith(prefix) && code !== account.code;
          })
          .reduce((sum, [, value]) => sum + value, 0);
        if (groupTotal !== 0) {
          monthData.values[account.code] = groupTotal;
        }
      }
    }

    // Calcular totais especiais (RL, MC, EBITDA, etc.)
    for (const [code, formula] of Object.entries(CALCULATED_TOTALS)) {
      let total = 0;
      for (const addCode of formula.add) {
        total += monthData.values[addCode] || 0;
      }
      for (const subtractCode of formula.subtract) {
        total -= monthData.values[subtractCode] || 0;
      }
      monthData.values[code] = total;
    }
  }

  return {
    data: {
      year,
      startMonth,
      endMonth,
      months: monthsData,
      accounts: DRE_CHART_OF_ACCOUNTS,
    },
  };
});
