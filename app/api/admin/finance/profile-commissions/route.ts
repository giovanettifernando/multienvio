/**
 * GET /api/admin/finance/profile-commissions
 *
 * Calcula comissões por perfil (coletores ou pontos de coleta).
 *
 * Parâmetros:
 * - dateStart, dateEnd: Período (obrigatório)
 * - profileType: 'collector' | 'pickup_point' (obrigatório)
 * - status: 'completed' | 'pending' | 'all' (default: 'all')
 *   - completed: Coletas já realizadas / Recepções já processadas
 *   - pending: Coletas na fila / Recepções pendentes
 *   - all: Ambos
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { startOfDayBrasilia, endOfDayBrasilia } from '@/shared/utils/date';


// Tipos para a resposta
export type ProfileType = 'collector' | 'pickup_point';
export type CommissionStatusFilter = 'completed' | 'pending' | 'all';

export interface CommissionItem {
  id: string;
  referenceCode: string;
  referenceId: string | null;
  description: string;
  commissionReais: number;
  status: 'completed' | 'pending';
  createdAt: string;
  completedAt: string | null;
}

export interface ProfileCommissionSummary {
  profileId: string;
  profileName: string;
  profileType: ProfileType;
  itemCount: number;
  completedCount: number;
  pendingCount: number;
  totalCommissionReais: number;
  completedCommissionReais: number;
  pendingCommissionReais: number;
  items: CommissionItem[];
}

export interface ProfileCommissionsResponse {
  period: {
    dateStart: string;
    dateEnd: string;
  };
  profileType: ProfileType;
  statusFilter: CommissionStatusFilter;
  summary: {
    totalProfiles: number;
    totalItems: number;
    totalCommissionReais: number;
    completedCommissionReais: number;
    pendingCommissionReais: number;
  };
  profiles: ProfileCommissionSummary[];
}

// Status de PickupRequest que indicam coleta realizada
const COMPLETED_PICKUP_STATUSES = ['COLLECTED', 'COMPLETED'];
// Status de PickupRequest que indicam coleta pendente/na fila
const PENDING_PICKUP_STATUSES = ['PENDING', 'SCHEDULED'];

// Status de Reception que indicam recepção realizada
const COMPLETED_RECEPTION_STATUSES = ['RECEIVED', 'PROCESSED', 'ISSUE_REPORTED'];
// Status de Reception que indicam recepção pendente
const PENDING_RECEPTION_STATUSES = ['PENDING'];

export const GET = withApiHandler<ProfileCommissionsResponse>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const searchParams = req.nextUrl.searchParams;
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');
  const profileType = searchParams.get('profileType') as ProfileType | null;
  const statusFilter = (searchParams.get('status') || 'all') as CommissionStatusFilter;

  // Validar parâmetros
  if (!dateStart || !dateEnd) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Período obrigatório (dateStart e dateEnd)',
      status: 400,
    });
  }

  if (!profileType || !['collector', 'pickup_point'].includes(profileType)) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Tipo de perfil obrigatório (profileType: collector | pickup_point)',
      status: 400,
    });
  }

  // Usar UTC-3 (Brasília) para filtros de data
  const startDate = startOfDayBrasilia(dateStart);
  const endDate = endOfDayBrasilia(dateEnd);

  let response: ProfileCommissionsResponse;

  if (profileType === 'collector') {
    response = await getCollectorCommissions(startDate, endDate, statusFilter);
  } else {
    response = await getPickupPointCommissions(startDate, endDate, statusFilter);
  }

  return { data: response };
});

async function getCollectorCommissions(
  startDate: Date,
  endDate: Date,
  statusFilter: CommissionStatusFilter
): Promise<ProfileCommissionsResponse> {
  // Determinar quais status buscar
  let statusesToInclude: string[] = [];
  if (statusFilter === 'completed') {
    statusesToInclude = COMPLETED_PICKUP_STATUSES;
  } else if (statusFilter === 'pending') {
    statusesToInclude = PENDING_PICKUP_STATUSES;
  } else {
    statusesToInclude = [...COMPLETED_PICKUP_STATUSES, ...PENDING_PICKUP_STATUSES];
  }

  // Buscar pickup requests com shipments no período
  const pickupRequests = await prisma.pickupRequest.findMany({
    where: {
      collectorId: { not: null },
      status: { in: statusesToInclude },
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
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Agrupar por coletor
  const collectorMap = new Map<string, ProfileCommissionSummary>();

  for (const pickup of pickupRequests) {
    if (!pickup.collector || !pickup.collectorId) continue;

    // Ignorar coletas sem comissão definida (pickupFee é o valor líquido da comissão)
    const pickupFee = pickup.shipment.pickupFee;
    if (!pickupFee || pickupFee <= 0) continue;

    const collectorId = pickup.collectorId;
    const collectorName = pickup.collector.pjRazaoSocial || pickup.collector.pfNome || 'Sem nome';
    const isCompleted = COMPLETED_PICKUP_STATUSES.includes(pickup.status);

    const item: CommissionItem = {
      id: pickup.id,
      referenceCode: pickup.shipment.platformTrackingCode,
      referenceId: pickup.shipment.id,
      description: `Coleta ${pickup.shipment.destinationCity}/${pickup.shipment.destinationState}`,
      commissionReais: pickupFee,
      status: isCompleted ? 'completed' : 'pending',
      createdAt: pickup.createdAt.toISOString(),
      completedAt: pickup.collectedAt?.toISOString() || null,
    };

    if (!collectorMap.has(collectorId)) {
      collectorMap.set(collectorId, {
        profileId: collectorId,
        profileName: collectorName,
        profileType: 'collector',
        itemCount: 0,
        completedCount: 0,
        pendingCount: 0,
        totalCommissionReais: 0,
        completedCommissionReais: 0,
        pendingCommissionReais: 0,
        items: [],
      });
    }

    const summary = collectorMap.get(collectorId)!;
    summary.itemCount++;
    summary.totalCommissionReais += pickupFee;
    summary.items.push(item);

    if (isCompleted) {
      summary.completedCount++;
      summary.completedCommissionReais += pickupFee;
    } else {
      summary.pendingCount++;
      summary.pendingCommissionReais += pickupFee;
    }
  }

  // Converter para array e ordenar por comissão total
  const profiles = Array.from(collectorMap.values())
    .sort((a, b) => b.totalCommissionReais - a.totalCommissionReais);

  // Calcular totais
  const totalProfiles = profiles.length;
  const totalItems = profiles.reduce((sum, p) => sum + p.itemCount, 0);
  const totalCommissionReais = profiles.reduce((sum, p) => sum + p.totalCommissionReais, 0);
  const completedCommissionReais = profiles.reduce((sum, p) => sum + p.completedCommissionReais, 0);
  const pendingCommissionReais = profiles.reduce((sum, p) => sum + p.pendingCommissionReais, 0);

  return {
    period: {
      dateStart: startDate.toISOString(),
      dateEnd: endDate.toISOString(),
    },
    profileType: 'collector',
    statusFilter,
    summary: {
      totalProfiles,
      totalItems,
      totalCommissionReais,
      completedCommissionReais,
      pendingCommissionReais,
    },
    profiles,
  };
}

async function getPickupPointCommissions(
  startDate: Date,
  endDate: Date,
  statusFilter: CommissionStatusFilter
): Promise<ProfileCommissionsResponse> {
  // Determinar quais status buscar
  let statusesToInclude: string[] = [];
  if (statusFilter === 'completed') {
    statusesToInclude = COMPLETED_RECEPTION_STATUSES;
  } else if (statusFilter === 'pending') {
    statusesToInclude = PENDING_RECEPTION_STATUSES;
  } else {
    statusesToInclude = [...COMPLETED_RECEPTION_STATUSES, ...PENDING_RECEPTION_STATUSES];
  }

  // Buscar receptions no período
  const receptions = await prisma.reception.findMany({
    where: {
      status: { in: statusesToInclude as never[] },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      pickupPoint: {
        select: {
          id: true,
          nomeFantasia: true,
          razaoSocial: true,
          commissionPerItem: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Agrupar por ponto de coleta
  const pickupPointMap = new Map<string, ProfileCommissionSummary>();

  for (const reception of receptions) {
    const pickupPointId = reception.pickupPointId;
    const pickupPointName = reception.pickupPoint.nomeFantasia || reception.pickupPoint.razaoSocial || 'Sem nome';

    // Comissão em centavos -> reais
    const commissionReais = reception.commissionCents / 100;
    const isCompleted = COMPLETED_RECEPTION_STATUSES.includes(reception.status);

    const item: CommissionItem = {
      id: reception.id,
      referenceCode: reception.trackingCode,
      referenceId: null,
      description: `Recepção de ${reception.senderName}`,
      commissionReais,
      status: isCompleted ? 'completed' : 'pending',
      createdAt: reception.createdAt.toISOString(),
      completedAt: reception.receivedAt?.toISOString() || reception.processedAt?.toISOString() || null,
    };

    if (!pickupPointMap.has(pickupPointId)) {
      pickupPointMap.set(pickupPointId, {
        profileId: pickupPointId,
        profileName: pickupPointName,
        profileType: 'pickup_point',
        itemCount: 0,
        completedCount: 0,
        pendingCount: 0,
        totalCommissionReais: 0,
        completedCommissionReais: 0,
        pendingCommissionReais: 0,
        items: [],
      });
    }

    const summary = pickupPointMap.get(pickupPointId)!;
    summary.itemCount++;
    summary.totalCommissionReais += commissionReais;
    summary.items.push(item);

    if (isCompleted) {
      summary.completedCount++;
      summary.completedCommissionReais += commissionReais;
    } else {
      summary.pendingCount++;
      summary.pendingCommissionReais += commissionReais;
    }
  }

  // Converter para array e ordenar por comissão total
  const profiles = Array.from(pickupPointMap.values())
    .sort((a, b) => b.totalCommissionReais - a.totalCommissionReais);

  // Calcular totais
  const totalProfiles = profiles.length;
  const totalItems = profiles.reduce((sum, p) => sum + p.itemCount, 0);
  const totalCommissionReais = profiles.reduce((sum, p) => sum + p.totalCommissionReais, 0);
  const completedCommissionReais = profiles.reduce((sum, p) => sum + p.completedCommissionReais, 0);
  const pendingCommissionReais = profiles.reduce((sum, p) => sum + p.pendingCommissionReais, 0);

  return {
    period: {
      dateStart: startDate.toISOString(),
      dateEnd: endDate.toISOString(),
    },
    profileType: 'pickup_point',
    statusFilter,
    summary: {
      totalProfiles,
      totalItems,
      totalCommissionReais,
      completedCommissionReais,
      pendingCommissionReais,
    },
    profiles,
  };
}
