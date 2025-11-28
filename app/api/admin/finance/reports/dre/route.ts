/**
 * GET /api/admin/finance/reports/dre - Retorna dados do DRE
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DRE_CHART_OF_ACCOUNTS, CALCULATED_TOTALS } from '@/lib/admin/finance/dre';

export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);
    const startMonth = parseInt(searchParams.get('startMonth') || '1', 10);
    const endMonth = parseInt(searchParams.get('endMonth') || '12', 10);

    // Validação
    if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
      return NextResponse.json(
        { message: 'Mês inválido. Use valores entre 1 e 12.' },
        { status: 400 }
      );
    }
    if (startMonth > endMonth) {
      return NextResponse.json(
        { message: 'Mês inicial não pode ser maior que mês final.' },
        { status: 400 }
      );
    }

    // Inicializar dados dos meses
    const monthsData: Array<{ month: number; year: number; values: Record<string, number> }> = [];
    for (let m = startMonth; m <= endMonth; m++) {
      monthsData.push({
        month: m,
        year,
        values: {},
      });
    }

    // 1. Buscar receitas de comissões de envios (shipments)
    const startDate = new Date(year, startMonth - 1, 1);
    const endDate = new Date(year, endMonth, 0, 23, 59, 59, 999);

    const shipmentCommissions = await prisma.shipment.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          notIn: ['CANCELED', 'REFUNDED'],
        },
      },
      _sum: {
        platformShippingCommissionCents: true,
        platformPickupCommissionCents: true,
        pickupFee: true,
      },
    });

    // Agrupar receitas por mês
    for (const row of shipmentCommissions) {
      const rowDate = new Date(row.createdAt);
      const month = rowDate.getMonth() + 1;
      if (month >= startMonth && month <= endMonth) {
        const monthData = monthsData.find((m) => m.month === month);
        if (monthData) {
          // 1.1.01 - Comissão sobre frete por envio
          monthData.values['1.1.01'] = (monthData.values['1.1.01'] || 0) +
            (row._sum.platformShippingCommissionCents || 0);

          // 1.2.01 - Comissão por coleta na origem
          monthData.values['1.2.01'] = (monthData.values['1.2.01'] || 0) +
            (row._sum.platformPickupCommissionCents || 0);
        }
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

    // Agrupar despesas por mês e conta DRE
    for (const expense of expenses) {
      const month = expense.createdAt.getMonth() + 1;
      if (month >= startMonth && month <= endMonth) {
        const monthData = monthsData.find((m) => m.month === month);
        if (monthData) {
          // Usar dreAccountCode se definido, senão usar mapeamento padrão
          const accountCode = expense.dreAccountCode ||
            EXPENSE_CATEGORY_TO_DRE[expense.category] ||
            '7.5.02';

          monthData.values[accountCode] = (monthData.values[accountCode] || 0) +
            expense.amountCents;
        }
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

    return NextResponse.json({
      year,
      startMonth,
      endMonth,
      months: monthsData,
      accounts: DRE_CHART_OF_ACCOUNTS,
    });
  } catch (error) {
    console.error('[DRE_REPORT] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao gerar relatório DRE' },
      { status: 500 }
    );
  }
}
