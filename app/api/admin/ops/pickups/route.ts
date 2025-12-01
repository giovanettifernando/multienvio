/**
 * GET /api/admin/ops/pickups
 *
 * Lista todas as coletas com filtros.
 *
 * Parâmetros:
 * - page: Número da página (default: 1)
 * - pageSize: Itens por página (default: 20)
 * - status: Filtro por status (PENDING, SCHEDULED, COLLECTED, FAILED, CANCELED, COMPLETED)
 * - collectorId: Filtro por coletor
 * - dateStart, dateEnd: Filtro por período
 * - q: Busca textual (código de rastreio, endereço, cidade)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';


const PICKUP_STATUS_ORDER: Record<string, number> = {
  PENDING: 1,
  SCHEDULED: 2,
  COLLECTED: 3,
  COMPLETED: 4,
  FAILED: 5,
  CANCELED: 6,
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
    const collectorId = searchParams.get('collectorId');
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
    const q = searchParams.get('q');

    const where: Prisma.PickupRequestWhereInput = {};

    // Filtro por status
    if (status && status !== 'all') {
      where.status = status;
    }

    // Filtro por coletor
    if (collectorId) {
      where.collectorId = collectorId;
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
        { originAddress: { contains: q, mode: 'insensitive' } },
        { originCity: { contains: q, mode: 'insensitive' } },
        { shipment: { platformTrackingCode: { contains: q, mode: 'insensitive' } } },
        { shipment: { carrierTrackingCode: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [pickups, total] = await Promise.all([
      prisma.pickupRequest.findMany({
        where,
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
              carrierTrackingCode: true,
              carrier: true,
              service: true,
              weight: true,
              declaredValue: true,
              recipientName: true,
              destinationCity: true,
              destinationState: true,
              pickupFee: true,
              status: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
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
      prisma.pickupRequest.count({ where }),
    ]);

    // Calcular resumo por status
    const statusSummary = await prisma.pickupRequest.groupBy({
      by: ['status'],
      where: dateStart || dateEnd ? {
        createdAt: where.createdAt,
      } : {},
      _count: true,
    });

    const summary = {
      total,
      byStatus: statusSummary.reduce(
        (acc, s) => {
          acc[s.status] = s._count;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    // Ordenar por prioridade de status
    const sortedPickups = pickups.sort((a, b) => {
      const orderA = PICKUP_STATUS_ORDER[a.status] || 99;
      const orderB = PICKUP_STATUS_ORDER[b.status] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      items: sortedPickups.map((pickup) => ({
        id: pickup.id,
        status: pickup.status,
        originCep: pickup.originCep,
        originAddress: pickup.originAddress,
        originCity: pickup.originCity,
        originUf: pickup.originUf,
        windowStart: pickup.windowStart?.toISOString() || null,
        windowEnd: pickup.windowEnd?.toISOString() || null,
        scheduleAt: pickup.scheduleAt?.toISOString() || null,
        collectedAt: pickup.collectedAt?.toISOString() || null,
        collectedBy: pickup.collectedBy,
        attemptCount: pickup.attemptCount,
        notes: pickup.notes,
        createdAt: pickup.createdAt.toISOString(),
        updatedAt: pickup.updatedAt.toISOString(),
        collector: pickup.collector
          ? {
              id: pickup.collector.id,
              name: pickup.collector.pjRazaoSocial || pickup.collector.pfNome || 'Sem nome',
              phone: pickup.collector.pfCelular || null,
            }
          : null,
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
              status: pickup.shipment.status,
            }
          : null,
        user: pickup.user
          ? {
              id: pickup.user.id,
              name: pickup.user.name,
              email: pickup.user.email,
              phone: pickup.user.phone,
            }
          : null,
      })),
      page,
      pageSize,
      total,
      summary,
    });
  } catch (error) {
    console.error('[PICKUPS_LIST] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao listar coletas' },
      { status: 500 }
    );
  }
}
