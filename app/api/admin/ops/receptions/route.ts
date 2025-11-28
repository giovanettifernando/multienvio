/**
 * GET /api/admin/ops/receptions
 *
 * Lista todas as recepções em pontos de coleta com filtros.
 *
 * Parâmetros:
 * - page: Número da página (default: 1)
 * - pageSize: Itens por página (default: 20)
 * - status: Filtro por status (PENDING, RECEIVED, ISSUE_REPORTED, PROCESSED)
 * - pickupPointId: Filtro por ponto de coleta
 * - dateStart, dateEnd: Filtro por período
 * - q: Busca textual (código de rastreio, nome do remetente/destinatário)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const RECEPTION_STATUS_ORDER: Record<string, number> = {
  PENDING: 1,
  RECEIVED: 2,
  ISSUE_REPORTED: 3,
  PROCESSED: 4,
};

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const status = searchParams.get('status');
    const pickupPointId = searchParams.get('pickupPointId');
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
    const q = searchParams.get('q');

    const where: Prisma.ReceptionWhereInput = {};

    // Filtro por status
    if (status && status !== 'all') {
      where.status = status as Prisma.EnumReceptionStatusFilter;
    }

    // Filtro por ponto de coleta
    if (pickupPointId) {
      where.pickupPointId = pickupPointId;
    }

    // Filtro por período
    if (dateStart || dateEnd) {
      where.createdAt = {};
      if (dateStart) {
        where.createdAt.gte = new Date(dateStart);
      }
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Busca textual
    if (q) {
      where.OR = [
        { trackingCode: { contains: q, mode: 'insensitive' } },
        { senderName: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        { pickupPoint: { nomeFantasia: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [receptions, total] = await Promise.all([
      prisma.reception.findMany({
        where,
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
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.reception.count({ where }),
    ]);

    // Calcular resumo por status
    const statusSummary = await prisma.reception.groupBy({
      by: ['status'],
      where: dateStart || dateEnd ? {
        createdAt: where.createdAt,
      } : {},
      _count: true,
    });

    // Calcular total de comissões
    const commissionTotal = await prisma.reception.aggregate({
      where,
      _sum: {
        commissionCents: true,
      },
    });

    const summary = {
      total,
      totalCommission: (commissionTotal._sum.commissionCents || 0) / 100,
      byStatus: statusSummary.reduce(
        (acc, s) => {
          acc[s.status] = s._count;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    // Ordenar por prioridade de status
    const sortedReceptions = receptions.sort((a, b) => {
      const orderA = RECEPTION_STATUS_ORDER[a.status] || 99;
      const orderB = RECEPTION_STATUS_ORDER[b.status] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      items: sortedReceptions.map((reception) => ({
        id: reception.id,
        status: reception.status,
        trackingCode: reception.trackingCode,
        senderName: reception.senderName,
        recipientName: reception.recipientName,
        commissionCents: reception.commissionCents,
        weight: reception.weight,
        declaredValue: reception.declaredValue,
        receivedAt: reception.receivedAt?.toISOString() || null,
        processedAt: reception.processedAt?.toISOString() || null,
        issueType: reception.issueType,
        issueDetails: reception.issueDetails,
        createdAt: reception.createdAt.toISOString(),
        updatedAt: reception.updatedAt.toISOString(),
        pickupPoint: reception.pickupPoint
          ? {
              id: reception.pickupPoint.id,
              name: reception.pickupPoint.nomeFantasia,
              city: reception.pickupPoint.cidade,
              state: reception.pickupPoint.uf,
            }
          : null,
      })),
      page,
      pageSize,
      total,
      summary,
    });
  } catch (error) {
    console.error('[RECEPTIONS_LIST] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao listar recepções' },
      { status: 500 }
    );
  }
}
