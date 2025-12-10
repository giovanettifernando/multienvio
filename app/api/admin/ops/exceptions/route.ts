/**
 * GET /api/admin/ops/exceptions
 *
 * Lista exceções operacionais:
 * - Divergências relatadas nos pontos de coleta (Reception com status ISSUE_REPORTED)
 * - Tentativas de coleta dos coletores (PickupRequest com attemptCount > 0)
 *
 * Parâmetros:
 * - page: Número da página (default: 1)
 * - pageSize: Itens por página (default: 20)
 * - type: Filtro por tipo (poc_issue, pickup_attempt, all)
 * - dateStart, dateEnd: Filtro por período
 * - q: Busca textual
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

interface ExceptionItem {
  id: string;
  type: 'poc_issue' | 'pickup_attempt';
  trackingCode: string | null;
  description: string;
  details: string | null;
  attemptCount?: number;
  issueType?: string | null;
  issuePhotos?: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
  // Para divergências de PoC
  pickupPoint?: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  } | null;
  // Para tentativas de coleta
  collector?: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  shipment?: {
    id: string;
    trackingCode: string;
    carrier: string | null;
    recipientName: string | null;
    destinationCity: string;
    destinationState: string;
  } | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ExceptionsResponse {
  items: ExceptionItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: {
    total: number;
    pocIssues: number;
    pickupAttempts: number;
  };
}

export const GET = withApiHandler<ExceptionsResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const searchParams = new URL(req.url).searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const type = searchParams.get('type') || 'all';
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');
  const q = searchParams.get('q');

  const exceptions: ExceptionItem[] = [];
  let totalPocIssues = 0;
  let totalPickupAttempts = 0;

  // Build date filter
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (dateStart) {
    dateFilter.gte = new Date(dateStart);
  }
  if (dateEnd) {
    const end = new Date(dateEnd);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  // Fetch PoC issues (Reception with ISSUE_REPORTED status)
  if (type === 'all' || type === 'poc_issue') {
    const pocWhere: Prisma.ReceptionWhereInput = {
      status: 'ISSUE_REPORTED',
    };

    if (dateStart || dateEnd) {
      pocWhere.createdAt = dateFilter;
    }

    if (q) {
      pocWhere.OR = [
        { trackingCode: { contains: q, mode: 'insensitive' } },
        { senderName: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        { issueDetails: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [pocIssues, pocCount] = await Promise.all([
      prisma.reception.findMany({
        where: pocWhere,
        include: {
          pickupPoint: {
            select: {
              id: true,
              nomeFantasia: true,
              cidade: true,
              uf: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: type === 'poc_issue' ? pageSize : 100,
        skip: type === 'poc_issue' ? (page - 1) * pageSize : 0,
      }),
      prisma.reception.count({ where: pocWhere }),
    ]);

    totalPocIssues = pocCount;

    for (const issue of pocIssues) {
      exceptions.push({
        id: `poc_${issue.id}`,
        type: 'poc_issue',
        trackingCode: issue.trackingCode,
        description: `Divergência relatada: ${issue.issueType || 'Não especificado'}`,
        details: issue.issueDetails,
        issueType: issue.issueType,
        issuePhotos: issue.issuePhotos,
        status: issue.status,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        pickupPoint: issue.pickupPoint
          ? {
              id: issue.pickupPoint.id,
              name: issue.pickupPoint.nomeFantasia,
              city: issue.pickupPoint.cidade,
              state: issue.pickupPoint.uf,
            }
          : null,
      });
    }
  }

  // Fetch pickup attempts (PickupRequest with attemptCount > 0)
  if (type === 'all' || type === 'pickup_attempt') {
    const pickupWhere: Prisma.PickupRequestWhereInput = {
      attemptCount: { gt: 0 },
    };

    if (dateStart || dateEnd) {
      pickupWhere.createdAt = dateFilter;
    }

    if (q) {
      pickupWhere.OR = [
        { originCity: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { shipment: { platformTrackingCode: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [pickupAttempts, pickupCount] = await Promise.all([
      prisma.pickupRequest.findMany({
        where: pickupWhere,
        include: {
          collector: {
            select: {
              id: true,
              pfNome: true,
              pjRazaoSocial: true,
              pfCelular: true,
            },
          },
          shipment: {
            select: {
              id: true,
              platformTrackingCode: true,
              carrier: true,
              recipientName: true,
              destinationCity: true,
              destinationState: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: type === 'pickup_attempt' ? pageSize : 100,
        skip: type === 'pickup_attempt' ? (page - 1) * pageSize : 0,
      }),
      prisma.pickupRequest.count({ where: pickupWhere }),
    ]);

    totalPickupAttempts = pickupCount;

    for (const attempt of pickupAttempts) {
      exceptions.push({
        id: `pickup_${attempt.id}`,
        type: 'pickup_attempt',
        trackingCode: attempt.shipment?.platformTrackingCode || null,
        description: `${attempt.attemptCount} tentativa(s) de coleta`,
        details: attempt.notes,
        attemptCount: attempt.attemptCount,
        status: attempt.status,
        createdAt: attempt.createdAt.toISOString(),
        updatedAt: attempt.updatedAt.toISOString(),
        collector: attempt.collector
          ? {
              id: attempt.collector.id,
              name: attempt.collector.pjRazaoSocial || attempt.collector.pfNome || 'Sem nome',
              phone: attempt.collector.pfCelular || null,
            }
          : null,
        shipment: attempt.shipment
          ? {
              id: attempt.shipment.id,
              trackingCode: attempt.shipment.platformTrackingCode,
              carrier: attempt.shipment.carrier,
              recipientName: attempt.shipment.recipientName,
              destinationCity: attempt.shipment.destinationCity,
              destinationState: attempt.shipment.destinationState,
            }
          : null,
        user: attempt.user
          ? {
              id: attempt.user.id,
              name: attempt.user.name,
              email: attempt.user.email,
            }
          : null,
      });
    }
  }

  // Sort by createdAt desc
  exceptions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Paginate if type is 'all'
  const total = type === 'all' ? totalPocIssues + totalPickupAttempts : (type === 'poc_issue' ? totalPocIssues : totalPickupAttempts);
  const paginatedExceptions = type === 'all'
    ? exceptions.slice((page - 1) * pageSize, page * pageSize)
    : exceptions;

  return {
    data: {
      items: paginatedExceptions,
      page,
      pageSize,
      total,
      summary: {
        total,
        pocIssues: totalPocIssues,
        pickupAttempts: totalPickupAttempts,
      },
    },
  };
});
