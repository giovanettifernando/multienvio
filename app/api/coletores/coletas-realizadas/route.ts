import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';
import { Prisma } from '@prisma/client';

/**
 * GET /api/coletores/coletas-realizadas
 * Lista coletas já realizadas pelo coletor logado
 *
 * Regra de negócio:
 * - Apenas coletas onde collectedAt não é nulo (coleta foi registrada)
 * - Não inclui coletas canceladas
 *
 * Status derivados:
 * - COLLECTED: "Aguardando entrega na transportadora" (collectedAt preenchido, status COLLECTED)
 * - COMPLETED: "Concluída" (status COMPLETED - indica entregue na transportadora)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAutonomousCollectorSession();
    if (!session) {
      console.log('[COLETORES_COLETAS_REALIZADAS] No session found');
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    console.log('[COLETORES_COLETAS_REALIZADAS] Session found:', {
      coletorId: session.coletorId,
      pfNome: session.pfNome
    });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
    const search = searchParams.get('search') ?? '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    console.log('[COLETORES_COLETAS_REALIZADAS] Query params:', {
      page,
      pageSize,
      search,
      dateFrom,
      dateTo
    });

    // Construir filtros base
    const where: Prisma.PickupRequestWhereInput = {
      collectorId: session.coletorId,
      collectedAt: {
        not: null, // Apenas coletas que foram efetivamente coletadas
      },
      status: {
        notIn: ['CANCELED', 'FAILED'], // Não trazer canceladas nem falhadas
      },
    };

    // Filtro de período (data da coleta)
    if (dateFrom || dateTo) {
      where.collectedAt = {
        not: null,
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    } else {
      // Se não informado, trazer dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      where.collectedAt = {
        not: null,
        gte: thirtyDaysAgo,
      };
    }

    // Filtro de busca (código, remetente)
    if (search.trim()) {
      where.OR = [
        {
          shipment: {
            platformTrackingCode: {
              contains: search.trim(),
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            name: {
              contains: search.trim(),
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            phone: {
              contains: search.trim(),
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    console.log('[COLETORES_COLETAS_REALIZADAS] WHERE filter:', JSON.stringify(where, null, 2));

    // Contar total
    const total = await prisma.pickupRequest.count({ where });
    console.log('[COLETORES_COLETAS_REALIZADAS] Total found:', total);

    // Buscar coletas realizadas
    const pickups = await prisma.pickupRequest.findMany({
      where,
      include: {
        shipment: {
          select: {
            id: true,
            platformTrackingCode: true,
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
            phone: true,
            addresses: {
              where: { isDefault: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { collectedAt: 'desc' }, // Mais recentes primeiro
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Mapear para formato do frontend
    const items = pickups.map((pickup) => {
      // Endereço do remetente (fallback)
      const senderAddress = pickup.user.addresses?.[0] ?? null;

      // Determinar status derivado
      // COMPLETED = Concluída (entregue na transportadora)
      // COLLECTED = Aguardando entrega na transportadora
      const derivedStatus = pickup.status === 'COMPLETED' ? 'CONCLUIDA' : 'AGUARDANDO_ENTREGA';

      return {
        id: pickup.id,
        userId: pickup.userId,
        collectorId: pickup.collectorId,
        shipmentId: pickup.shipmentId,
        originCep: pickup.originCep,
        originAddress: pickup.originAddress,
        originCity: pickup.originCity,
        originUf: pickup.originUf,
        status: pickup.status,
        derivedStatus, // Status exibido na tela
        collectedAt: pickup.collectedAt?.toISOString() ?? null,
        collectedBy: pickup.collectedBy,
        scannedCode: pickup.scannedCode,
        createdAt: pickup.createdAt.toISOString(),
        updatedAt: pickup.updatedAt.toISOString(),
        shipment: {
          id: pickup.shipment.id,
          trackingCode: pickup.shipment.platformTrackingCode,
          carrier: pickup.shipment.carrier,
          service: pickup.shipment.service,
          weight: pickup.shipment.weight,
          declaredValue: pickup.shipment.declaredValue,
          recipientName: pickup.shipment.recipientName,
          destinationCity: pickup.shipment.destinationCity,
          destinationState: pickup.shipment.destinationState,
          originCep: pickup.shipment.originCep,
          pickupFee: pickup.shipment.pickupFee,
        },
        user: {
          id: pickup.user.id,
          name: pickup.user.name,
          email: pickup.user.email,
          phone: pickup.user.phone,
        },
        senderAddress: senderAddress ? {
          id: senderAddress.id,
          cep: senderAddress.cep,
          logradouro: senderAddress.logradouro,
          numero: senderAddress.numero,
          complemento: senderAddress.complemento,
          bairro: senderAddress.bairro,
          cidade: senderAddress.cidade,
          uf: senderAddress.uf,
        } : null,
      };
    });

    const response = {
      items,
      page,
      pageSize,
      total,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[COLETORES_COLETAS_REALIZADAS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar coletas realizadas';
    return NextResponse.json({ message }, { status: 500 });
  }
}
