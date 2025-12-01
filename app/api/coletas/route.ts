import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import type { Prisma } from '@prisma/client';
import type {
  PickupRequestWithShipment,
  PickupRequestsResponse,
  PickupStatus,
  CreatePickupRequestData,
} from '@/lib/types/pickup';

/**
 * GET /api/coletas
 * Lista pickup requests do usuário com filtros
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '10', 10);
    const statusParam = searchParams.get('status') ?? 'PENDING,SCHEDULED'; // Padrão: apenas coletas pendentes
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
    const city = searchParams.get('city');
    const q = searchParams.get('q') ?? '';

    // Construir filtros
    const where: Prisma.PickupRequestWhereInput = {
      userId: session.userId,
    };

    // Filtro por status - suporta múltiplos status separados por vírgula
    if (statusParam && statusParam !== 'all') {
      const statuses = statusParam.split(',').map(s => s.trim()) as PickupStatus[];
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else {
        where.status = { in: statuses };
      }
    }

    // Filtro por cidade
    if (city) {
      where.originCity = { contains: city, mode: 'insensitive' };
    }

    // Filtro por data
    if (dateStart || dateEnd) {
      where.createdAt = {};
      if (dateStart) {
        where.createdAt.gte = new Date(dateStart);
      }
      if (dateEnd) {
        where.createdAt.lte = new Date(dateEnd);
      }
    }

    // Busca por tracking code ou CEP
    if (q && q.trim().length > 0) {
      where.OR = [
        { originCep: { contains: q, mode: 'insensitive' } },
        { shipment: { platformTrackingCode: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Contar total
    const total = await prisma.pickupRequest.count({ where });

    // Buscar pickup requests
    const pickups = await prisma.pickupRequest.findMany({
      where,
      include: {
        shipment: {
          select: {
            id: true,
            platformTrackingCode: true,
            carrier: true,
            service: true,
          },
        },
        collector: {
          select: {
            id: true,
            pfNome: true,
          },
        },
      },
      orderBy: [
        { scheduleAt: { sort: 'asc', nulls: 'last' } }, // Data agendada primeiro (nulls no final)
        { createdAt: 'desc' }, // Fallback: mais recentes primeiro
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Mapear para formato do frontend
    const items: PickupRequestWithShipment[] = pickups.map((pickup) => ({
      id: pickup.id,
      companyId: pickup.companyId,
      userId: pickup.userId,
      collectorId: pickup.collectorId,
      shipmentId: pickup.shipmentId,
      originCep: pickup.originCep,
      originAddress: pickup.originAddress,
      originCity: pickup.originCity,
      originUf: pickup.originUf,
      windowStart: pickup.windowStart?.toISOString() ?? null,
      windowEnd: pickup.windowEnd?.toISOString() ?? null,
      status: pickup.status as PickupStatus,
      notes: pickup.notes,
      scheduleAt: pickup.scheduleAt?.toISOString() ?? null,
      attemptCount: pickup.attemptCount,
      createdAt: pickup.createdAt.toISOString(),
      updatedAt: pickup.updatedAt.toISOString(),
      shipment: {
        id: pickup.shipment.id,
        trackingCode: pickup.shipment.platformTrackingCode, // Expor apenas código da plataforma
        carrier: pickup.shipment.carrier,
        service: pickup.shipment.service,
      },
      collector: pickup.collector ? {
        id: pickup.collector.id,
        name: pickup.collector.pfNome,
      } : null,
    }));

    const response: PickupRequestsResponse = {
      items,
      page,
      pageSize,
      total,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[COLETAS_GET]', error);
    // 🛡️ SECURITY FIX: Não expor mensagens de erro internas
    return NextResponse.json({ message: 'Erro ao listar coletas' }, { status: 500 });
  }
}

/**
 * POST /api/coletas
 * Cria uma nova pickup request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const body: CreatePickupRequestData = await request.json();
    const { shipmentId, windowStart, windowEnd, notes } = body;

    if (!shipmentId) {
      return NextResponse.json({ message: 'shipmentId é obrigatório' }, { status: 400 });
    }

    // Verificar se o shipment existe e pertence ao usuário
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        senderId: true,
        originCep: true,
        pickupRequest: true, // Verificar se já existe coleta
      },
    });

    if (!shipment) {
      return NextResponse.json({ message: 'Envio não encontrado' }, { status: 404 });
    }

    if (shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Idempotência: verificar se já existe pickup request para este shipment
    if (shipment.pickupRequest) {
      return NextResponse.json({
        message: 'Já existe uma coleta para este envio',
        pickupRequest: {
          id: shipment.pickupRequest.id,
          status: shipment.pickupRequest.status,
        },
      }, { status: 409 });
    }

    // Criar pickup request
    // Nota: A criação via POST manual aqui é apenas para casos especiais
    // A criação normal de coletas acontece automaticamente no checkout
    const pickupRequest = await prisma.pickupRequest.create({
      data: {
        userId: session.userId,
        shipmentId,
        originCep: shipment.originCep,
        originAddress: null, // Será preenchido manualmente se necessário
        originCity: null,
        originUf: null,
        windowStart: windowStart ? new Date(windowStart) : null,
        windowEnd: windowEnd ? new Date(windowEnd) : null,
        notes,
        status: 'PENDING',
      },
      include: {
        shipment: {
          select: {
            id: true,
            platformTrackingCode: true,
            carrier: true,
            service: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Coleta criada com sucesso',
      pickupRequest: {
        id: pickupRequest.id,
        status: pickupRequest.status,
        shipmentId: pickupRequest.shipmentId,
        originCep: pickupRequest.originCep,
        createdAt: pickupRequest.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[COLETAS_POST]', error);

    // Erro de constraint UNIQUE (Prisma error code)
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({
        message: 'Já existe uma coleta para este envio',
      }, { status: 409 });
    }

    // 🛡️ SECURITY FIX: Não expor mensagens de erro internas
    return NextResponse.json({ message: 'Erro ao criar coleta' }, { status: 500 });
  }
}
