/**
 * API Route para dashboard de coletor autônomo
 * GET /api/coletores/dashboard - Retorna KPIs e dados do dashboard
 */


import { NextResponse } from 'next/server';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import { prisma } from '@/lib/db';

/**
 * GET /api/coletores/dashboard
 * Retorna KPIs do coletor logado
 */
export async function GET() {
  try {
    const session = await getAutonomousCollectorSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    console.log('[DASHBOARD] Loading for collector:', session.coletorId);

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
      return NextResponse.json({ message: 'Coletor não encontrado' }, { status: 404 });
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

    // 1. Coletas Pendentes (status PENDING, collectedAt nulo)
    const pendingCount = await prisma.pickupRequest.count({
      where: {
        collectorId: session.coletorId,
        status: 'PENDING',
        collectedAt: null,
      },
    });

    // 2. Coletas Hoje (collectedAt entre todayStart e todayEnd)
    const todayCount = await prisma.pickupRequest.count({
      where: {
        collectorId: session.coletorId,
        collectedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // 3. Coletas no Mês (collectedAt entre monthStart e monthEnd)
    const monthlyCount = await prisma.pickupRequest.count({
      where: {
        collectorId: session.coletorId,
        collectedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // 4. Coletas no Mês Anterior (para variação percentual)
    const lastMonthCount = await prisma.pickupRequest.count({
      where: {
        collectorId: session.coletorId,
        collectedAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
    });

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
        // Nota: não há campo de distância no PickupRequest atual
        // Por simplicidade, vamos calcular baseado apenas em quantidade de coletas
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

    console.log('[DASHBOARD] KPIs calculated:', {
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
      recentCollections: [], // Removido conforme solicitado
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('[DASHBOARD_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao carregar dashboard';
    return NextResponse.json({ message }, { status: 500 });
  }
}
