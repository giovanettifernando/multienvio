
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';
import { ReceptionStatus } from '@prisma/client';

async function requireCollectorSession(request: Request) {
  const session = await getCollectorSessionFromRequest(request);
  if (!session) {
    throw NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const point = await prisma.pickupPoint.findUnique({
    where: { id: session.pointId },
    select: {
      id: true,
      status: true,
      commissionPerItem: true,
    },
  });

  if (!point) {
    throw NextResponse.json({ message: 'Ponto não encontrado' }, { status: 404 });
  }

  if (point.status !== 'ACTIVE') {
    throw NextResponse.json(
      { message: 'Ponto de coleta inativo ou bloqueado' },
      { status: 403 }
    );
  }

  return { pointId: point.id, commissionPerItem: point.commissionPerItem };
}

// GET /api/pontos-coleta/dashboard - KPIs e estatísticas
export async function GET(request: Request) {
  try {
    const { pointId } = await requireCollectorSession(request);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Buscar todas as métricas em paralelo
    const [
      pendingCount,
      todayReceived,
      monthlyReceived,
      lastMonthReceived,
      monthlyCommission,
      lastMonthCommission,
      recentReceptions,
    ] = await Promise.all([
      // Aguardando recebimento
      prisma.reception.count({
        where: {
          pickupPointId: pointId,
          status: ReceptionStatus.PENDING,
        },
      }),

      // Recebidos hoje
      prisma.reception.count({
        where: {
          pickupPointId: pointId,
          status: {
            in: [ReceptionStatus.RECEIVED, ReceptionStatus.ISSUE_REPORTED],
          },
          receivedAt: {
            gte: startOfToday,
          },
        },
      }),

      // Recebidos no mês atual
      prisma.reception.count({
        where: {
          pickupPointId: pointId,
          status: {
            in: [ReceptionStatus.RECEIVED, ReceptionStatus.ISSUE_REPORTED, ReceptionStatus.PROCESSED],
          },
          receivedAt: {
            gte: startOfMonth,
          },
        },
      }),

      // Recebidos no mês passado
      prisma.reception.count({
        where: {
          pickupPointId: pointId,
          status: {
            in: [ReceptionStatus.RECEIVED, ReceptionStatus.ISSUE_REPORTED, ReceptionStatus.PROCESSED],
          },
          receivedAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),

      // Comissão do mês atual
      prisma.reception.aggregate({
        where: {
          pickupPointId: pointId,
          status: {
            in: [ReceptionStatus.RECEIVED, ReceptionStatus.ISSUE_REPORTED, ReceptionStatus.PROCESSED],
          },
          receivedAt: {
            gte: startOfMonth,
          },
        },
        _sum: {
          commissionCents: true,
        },
      }),

      // Comissão do mês passado
      prisma.reception.aggregate({
        where: {
          pickupPointId: pointId,
          status: {
            in: [ReceptionStatus.RECEIVED, ReceptionStatus.ISSUE_REPORTED, ReceptionStatus.PROCESSED],
          },
          receivedAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
        _sum: {
          commissionCents: true,
        },
      }),

      // Últimas 5 recepções
      prisma.reception.findMany({
        where: {
          pickupPointId: pointId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          trackingCode: true,
          senderName: true,
          status: true,
          receivedAt: true,
          createdAt: true,
        },
      }),
    ]);

    // Calcular comparações com mês anterior
    const monthlyChange = lastMonthReceived > 0
      ? ((monthlyReceived - lastMonthReceived) / lastMonthReceived) * 100
      : monthlyReceived > 0 ? 100 : 0;

    const commissionChange = (lastMonthCommission._sum.commissionCents || 0) > 0
      ? (((monthlyCommission._sum.commissionCents || 0) - (lastMonthCommission._sum.commissionCents || 0)) / (lastMonthCommission._sum.commissionCents || 0)) * 100
      : (monthlyCommission._sum.commissionCents || 0) > 0 ? 100 : 0;

    return NextResponse.json({
      kpis: {
        pending: {
          value: pendingCount,
          label: 'Aguardando Recebimento',
        },
        today: {
          value: todayReceived,
          label: 'Recebidos Hoje',
        },
        monthly: {
          value: monthlyReceived,
          change: Math.round(monthlyChange * 10) / 10, // Uma casa decimal
          label: 'Recebidos no Mês',
        },
        commission: {
          value: (monthlyCommission._sum.commissionCents || 0) / 100,
          change: Math.round(commissionChange * 10) / 10,
          label: 'Comissão do Mês',
        },
      },
      recentReceptions,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[COLLECTOR_DASHBOARD]', error);
    return NextResponse.json({ message: 'Erro ao buscar dashboard' }, { status: 500 });
  }
}
