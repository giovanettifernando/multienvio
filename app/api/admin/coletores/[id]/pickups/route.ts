/**
 * GET /api/admin/coletores/[id]/pickups
 *
 * Lista coletas do coletor com filtro de período e estatísticas
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
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

  const permissionError = requirePermission(session, AdminPermission.COLETORES);
  if (permissionError) return permissionError;

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

    // Status filter (optional)
    const statusFilter = searchParams.get('status');

    // Verify collector exists
    const collector = await prisma.collector.findUnique({
      where: { id },
      select: {
        id: true,
        commissionKind: true,
        commissionAmount: true,
        commissionAmountPerKm: true,
      },
    });

    if (!collector) {
      return NextResponse.json(
        { message: 'Coletor não encontrado' },
        { status: 404 }
      );
    }

    // Build where clause
    const whereClause: {
      collectorId: string;
      collectedAt?: { gte: Date; lte: Date };
      status?: string | { in: string[] };
    } = {
      collectorId: id,
      collectedAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    if (statusFilter && statusFilter !== 'all') {
      whereClause.status = statusFilter;
    } else {
      // By default, show only completed pickups (COLLECTED or COMPLETED)
      whereClause.status = { in: ['COLLECTED', 'COMPLETED'] };
    }

    // Fetch pickups with shipment data
    const [pickups, total] = await Promise.all([
      prisma.pickupRequest.findMany({
        where: whereClause,
        include: {
          shipment: {
            select: {
              id: true,
              platformTrackingCode: true,
              carrierTrackingCode: true,
              carrier: true,
              service: true,
              weight: true,
              declaredValue: true,
              recipientName: true,
              destinationCity: true,
              destinationState: true,
              originCep: true,
              pickupFee: true,
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
        orderBy: { collectedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.pickupRequest.count({ where: whereClause }),
    ]);

    // Calculate statistics for the filtered period
    const statsWhere = {
      collectorId: id,
      collectedAt: {
        gte: dateFrom,
        lte: dateTo,
      },
      status: { in: ['COLLECTED', 'COMPLETED'] },
    };

    const statsPickups = await prisma.pickupRequest.findMany({
      where: statsWhere,
      include: {
        shipment: {
          select: {
            pickupFee: true,
          },
        },
      },
    });

    // Calculate totals
    const totalPickups = statsPickups.length;
    const totalCommission = statsPickups.reduce((acc, pickup) => {
      return acc + (pickup.shipment?.pickupFee || 0);
    }, 0);

    // Note: We don't have km tracking per pickup in the current schema
    // If you have a distanceKm field or similar, it would be calculated here
    const totalKm = 0; // Placeholder - would need distanceKm field in schema

    return NextResponse.json({
      items: pickups.map((pickup) => ({
        id: pickup.id,
        status: pickup.status,
        originCep: pickup.originCep,
        originAddress: pickup.originAddress,
        originCity: pickup.originCity,
        originUf: pickup.originUf,
        collectedAt: pickup.collectedAt?.toISOString() || null,
        collectedBy: pickup.collectedBy,
        scannedCode: pickup.scannedCode,
        scheduleAt: pickup.scheduleAt?.toISOString() || null,
        createdAt: pickup.createdAt.toISOString(),
        shipment: pickup.shipment
          ? {
              id: pickup.shipment.id,
              trackingCode: pickup.shipment.platformTrackingCode,
              carrierTrackingCode: pickup.shipment.carrierTrackingCode,
              carrier: pickup.shipment.carrier,
              service: pickup.shipment.service,
              weight: pickup.shipment.weight,
              declaredValue: pickup.shipment.declaredValue,
              recipientName: pickup.shipment.recipientName,
              destinationCity: pickup.shipment.destinationCity,
              destinationState: pickup.shipment.destinationState,
              pickupFee: pickup.shipment.pickupFee,
            }
          : null,
        user: pickup.user
          ? {
              id: pickup.user.id,
              name: pickup.user.name,
              email: pickup.user.email,
            }
          : null,
      })),
      page,
      pageSize,
      total,
      stats: {
        totalPickups,
        totalKm,
        totalCommission,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/coletores/[id]/pickups]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar coletas do coletor' },
      { status: 500 }
    );
  }
}
