/**
 * GET /api/admin/pickup-points/[id]/receptions
 *
 * Lista recepções do ponto de coleta com filtro de período e estatísticas
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { canAccess } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const staff = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: { isSuperAdmin: true, permissions: true, status: true },
  });

  if (!staff || staff.status !== 'ACTIVE') {
    return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
  }

  if (!canAccess(staff, AdminPermission.PONTOS_COLETA)) {
    return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);

    // Parse date filters - default to start of current month to today
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');

    const dateFrom = dateFromParam ? new Date(dateFromParam) : startOfMonth;
    const dateTo = dateToParam ? new Date(dateToParam) : now;

    // Ensure dateTo includes the full day
    dateTo.setHours(23, 59, 59, 999);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const skip = (page - 1) * pageSize;

    // Verify point exists
    const point = await prisma.pickupPoint.findUnique({
      where: { id },
      select: { id: true, nomeFantasia: true },
    });

    if (!point) {
      return NextResponse.json(
        { message: 'Ponto de coleta não encontrado' },
        { status: 404 }
      );
    }

    // Build where clause
    const whereClause = {
      pickupPointId: id,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    // Fetch receptions
    const [receptions, total] = await Promise.all([
      prisma.reception.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.reception.count({ where: whereClause }),
    ]);

    // Calculate statistics for the filtered period
    const statsWhere = {
      pickupPointId: id,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    const [statsReceptions, commissionSum] = await Promise.all([
      prisma.reception.findMany({
        where: statsWhere,
        select: {
          status: true,
          commissionCents: true,
        },
      }),
      prisma.reception.aggregate({
        where: statsWhere,
        _sum: {
          commissionCents: true,
        },
      }),
    ]);

    // Calculate totals by status
    const totalReceptions = statsReceptions.length;
    const receivedCount = statsReceptions.filter((r) => r.status === 'RECEIVED' || r.status === 'PROCESSED').length;
    const pendingCount = statsReceptions.filter((r) => r.status === 'PENDING').length;
    const issueCount = statsReceptions.filter((r) => r.status === 'ISSUE_REPORTED').length;
    const totalCommission = (commissionSum._sum.commissionCents || 0) / 100;

    return NextResponse.json({
      items: receptions.map((reception) => ({
        id: reception.id,
        trackingCode: reception.trackingCode,
        senderName: reception.senderName,
        recipientName: reception.recipientName,
        weight: reception.weight,
        declaredValue: reception.declaredValue,
        status: reception.status,
        expectedAt: reception.expectedAt?.toISOString() || null,
        receivedAt: reception.receivedAt?.toISOString() || null,
        processedAt: reception.processedAt?.toISOString() || null,
        issueType: reception.issueType,
        issueDetails: reception.issueDetails,
        commissionCents: reception.commissionCents,
        createdAt: reception.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      stats: {
        totalReceptions,
        receivedCount,
        pendingCount,
        issueCount,
        totalCommission,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/pickup-points/[id]/receptions]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar recepções do ponto' },
      { status: 500 }
    );
  }
}
