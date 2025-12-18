/**
 * API Route para dashboard de coletor autônomo
 * GET /api/coletores/dashboard - Retorna KPIs e dados do dashboard
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAutonomousCollectorSession } from '@/modules/auth/application/autonomous-collector-session';
import { prisma } from '@/platform/db/db';

type CollectorDashboardResponse = {
  kpis: {
    pending: { value: number; label: string };
    today: { value: number; label: string };
    monthly: { value: number; change: number; label: string };
    commission: { value: number; change: number; label: string };
  };
  recentCollections: Array<unknown>;
};

/**
 * GET /api/coletores/dashboard
 * Retorna KPIs do coletor logado
 */
export const GET = withApiHandler<CollectorDashboardResponse>(async (context) => {
  const { logger } = context;

  const session = await getAutonomousCollectorSession();
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  logger.info('dashboard_loading', { coletorId: session.coletorId });

  // Buscar dados do coletor para calcular comissão
  const collector = await prisma.collector.findUnique({
    where: { id: session.coletorId },
    select: {
      commissionKind: true,
      commissionAmount: true,
      commissionAmountPerKm: true,
      pickupFeeType: true,
      pickupFixedFee: true,
      pickupFeePerKm: true,
    },
  });

  if (!collector) {
    throw new ApiError({ code: 'not_found', message: 'Coletor não encontrado', status: 404 });
  }

  // Data atual
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // Início e fim do mês atual
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Início e fim do mês anterior (para calcular variação)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Buscar todos os counts em paralelo para melhor performance
  const [pendingCount, todayCount, monthlyCount, lastMonthCount] = await Promise.all([
    // 1. Coletas Pendentes (status PENDING, collectedAt nulo)
    prisma.pickupRequest.count({
      where: {
        collectorId: session.coletorId,
        status: 'PENDING',
        collectedAt: null,
      },
    }),
    // 2. Coletas Hoje (collectedAt entre todayStart e todayEnd)
    prisma.pickupRequest.count({
      where: {
        collectorId: session.coletorId,
        collectedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    }),
    // 3. Coletas no Mês (collectedAt entre monthStart e monthEnd)
    prisma.pickupRequest.count({
      where: {
        collectorId: session.coletorId,
        collectedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    }),
    // 4. Coletas no Mês Anterior (para variação percentual)
    prisma.pickupRequest.count({
      where: {
        collectorId: session.coletorId,
        collectedAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
    }),
  ]);

  // Calcular variação percentual do mês
  const monthlyChange =
    lastMonthCount > 0
      ? Math.round(((monthlyCount - lastMonthCount) / lastMonthCount) * 100)
      : monthlyCount > 0
      ? 100
      : 0;

  // 5. Comissão do Mês (baseada no tipo de comissão)
  // Buscar coletas do mês com dados de distância (se houver)
  const monthlyPickups = await prisma.pickupRequest.findMany({
    where: {
      collectorId: session.coletorId,
      collectedAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    select: {
      id: true,
    },
  });

  let commissionThisMonth = 0;

  if (collector.commissionKind === 'FIXA') {
    // Comissão fixa por coleta
    const fixedAmount = collector.commissionAmount ?? 0;
    commissionThisMonth = monthlyPickups.length * fixedAmount;
  } else if (collector.commissionKind === 'POR_KM') {
    // Comissão por km - como não temos distância no pickup, usar média
    const perKm = collector.commissionAmountPerKm ?? 0;
    // Assumir média de 5km por coleta para cálculo demonstrativo
    const avgKm = 5;
    commissionThisMonth = monthlyPickups.length * avgKm * perKm;
  }

  // Comissão do mês anterior (para variação)
  const lastMonthPickups = await prisma.pickupRequest.count({
    where: {
      collectorId: session.coletorId,
      collectedAt: {
        gte: lastMonthStart,
        lte: lastMonthEnd,
      },
    },
  });

  let commissionLastMonth = 0;

  if (collector.commissionKind === 'FIXA') {
    const fixedAmount = collector.commissionAmount ?? 0;
    commissionLastMonth = lastMonthPickups * fixedAmount;
  } else if (collector.commissionKind === 'POR_KM') {
    const perKm = collector.commissionAmountPerKm ?? 0;
    const avgKm = 5;
    commissionLastMonth = lastMonthPickups * avgKm * perKm;
  }

  const commissionChange =
    commissionLastMonth > 0
      ? Math.round(((commissionThisMonth - commissionLastMonth) / commissionLastMonth) * 100)
      : commissionThisMonth > 0
      ? 100
      : 0;

  logger.info('dashboard_kpis_calculated', {
    coletorId: session.coletorId,
    pending: pendingCount,
    today: todayCount,
    monthly: monthlyCount,
    commission: commissionThisMonth,
  });

  const dashboardData = {
    kpis: {
      pending: { value: pendingCount, label: 'Coletas Pendentes' },
      today: { value: todayCount, label: 'Coletas Hoje' },
      monthly: { value: monthlyCount, change: monthlyChange, label: 'Coletas no Mês' },
      commission: { value: commissionThisMonth, change: commissionChange, label: 'Comissão (R$)' },
    },
    recentCollections: [],
  };

  return { data: dashboardData };
});
