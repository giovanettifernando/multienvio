export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';

/**
 * GET /api/coletores/coletas
 * Lista pickup requests pendentes atribuídas ao coletor logado
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAutonomousCollectorSession();
    if (!session) {
      console.log('[COLETORES_COLETAS] No session found');
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    console.log('[COLETORES_COLETAS] Session found:', { coletorId: session.coletorId, pfNome: session.pfNome });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
    const status = searchParams.get('status') ?? 'PENDING';

    console.log('[COLETORES_COLETAS] Query params:', { page, pageSize, status });

    // Construir filtros
    const where: {
      collectorId: string;
      status?: string;
    } = {
      collectorId: session.coletorId,
    };

    // Filtro por status - apenas pendentes por padrão
    if (status && status !== 'all') {
      where.status = status;
    }

    console.log('[COLETORES_COLETAS] WHERE filter:', where);

    // Contar total
    const total = await prisma.pickupRequest.count({ where });
    console.log('[COLETORES_COLETAS] Total found:', total);

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
            weight: true,
            declaredValue: true,
            recipientName: true,
            destinationCity: true,
            destinationState: true,
            originCep: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            addresses: {
              where: {
                OR: [
                  { isDefault: true },
                  { role: 'sender' },
                ],
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Mapear para formato do frontend
    const items = pickups.map((pickup) => {
      // Endereço do remetente (fallback)
      const senderAddress = pickup.user.addresses?.[0] ?? null;

      return {
        id: pickup.id,
        userId: pickup.userId,
        collectorId: pickup.collectorId,
        shipmentId: pickup.shipmentId,
        originCep: pickup.originCep,
        originAddress: pickup.originAddress,
        originCity: pickup.originCity,
        originUf: pickup.originUf,
        windowStart: pickup.windowStart?.toISOString() ?? null,
        windowEnd: pickup.windowEnd?.toISOString() ?? null,
        status: pickup.status,
        notes: pickup.notes,
        scheduleAt: pickup.scheduleAt?.toISOString() ?? null,
        attemptCount: pickup.attemptCount,
        attemptNotes: pickup.attemptNotes,
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
    console.error('[COLETORES_COLETAS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao listar coletas';
    return NextResponse.json({ message }, { status: 500 });
  }
}
