import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { getCollectorSessionFromRequest } from '@/modules/auth/application/collector-session';
import { ReceptionStatus } from '@prisma/client';

type DashboardResponse = {
  kpis: {
    pending: {
      value: number;
      label: string;
    };
    today: {
      value: number;
      label: string;
    };
    monthly: {
      value: number;
      change: number;
      label: string;
    };
    commission: {
      value: number;
      change: number;
      label: string;
    };
  };
  recentReceptions: Array<{
    id: string;
    trackingCode: string | null;
    senderName: string | null;
    status: ReceptionStatus;
    receivedAt: string | null;
    createdAt: string;
  }>;
};

async function requireCollectorSession(request: Request) {
  const session = await getCollectorSessionFromRequest(request);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
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
    throw new ApiError({ code: 'not_found', message: 'Ponto não encontrado', status: 404 });
  }

  if (point.status !== 'ACTIVE') {
    throw new ApiError({
      code: 'forbidden',
      message: 'Ponto de coleta inativo ou bloqueado',
      status: 403,
    });
  }

  return { pointId: point.id, commissionPerItem: point.commissionPerItem };
}

// GET /api/pontos-coleta/dashboard - KPIs e estatísticas
export const GET = withApiHandler<DashboardResponse>(async (context) => {
  const { pointId } = await requireCollectorSession(context.req);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    pendingCount,
    todayReceived,
    monthlyReceived,
    lastMonthReceived,
    monthlyCommission,
    lastMonthCommission,
    recentReceptions,
  ] = await Promise.all([
    prisma.reception.count({
      where: {
        pickupPointId: pointId,
        status: ReceptionStatus.PENDING,
      },
    }),

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

  const monthlyCommissionValue = monthlyCommission._sum.commissionCents ?? 0;
  const lastMonthCommissionValue = lastMonthCommission._sum.commissionCents ?? 0;

  const monthlyChange = lastMonthReceived > 0
    ? ((monthlyReceived - lastMonthReceived) / lastMonthReceived) * 100
    : monthlyReceived > 0 ? 100 : 0;

  const commissionChange = lastMonthCommissionValue > 0
    ? ((monthlyCommissionValue - lastMonthCommissionValue) / lastMonthCommissionValue) * 100
    : monthlyCommissionValue > 0 ? 100 : 0;

  return {
    data: {
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
          change: Math.round(monthlyChange * 10) / 10,
          label: 'Recebidos no Mês',
        },
        commission: {
          value: monthlyCommissionValue / 100,
          change: Math.round(commissionChange * 10) / 10,
          label: 'Comissão do Mês',
        },
      },
      recentReceptions: recentReceptions.map((reception) => ({
        id: reception.id,
        trackingCode: reception.trackingCode,
        senderName: reception.senderName,
        status: reception.status,
        receivedAt: reception.receivedAt?.toISOString() ?? null,
        createdAt: reception.createdAt.toISOString(),
      })),
    },
  };
});
