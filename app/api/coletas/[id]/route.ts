
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import type { UpdatePickupRequestData } from '@/lib/types/pickup';

/**
 * PATCH /api/coletas/[id]
 * Atualiza uma pickup request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;
    const body: UpdatePickupRequestData = await request.json();
    const { status, windowStart, windowEnd, notes } = body;

    // Verificar se a pickup request existe e pertence ao usuário
    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!pickupRequest) {
      return NextResponse.json({ message: 'Coleta não encontrada' }, { status: 404 });
    }

    if (pickupRequest.userId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Atualizar pickup request
    const updated = await prisma.pickupRequest.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(windowStart !== undefined && { windowStart: windowStart ? new Date(windowStart) : null }),
        ...(windowEnd !== undefined && { windowEnd: windowEnd ? new Date(windowEnd) : null }),
        ...(notes !== undefined && { notes }),
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
      message: 'Coleta atualizada com sucesso',
      pickupRequest: {
        id: updated.id,
        status: updated.status,
        windowStart: updated.windowStart?.toISOString() ?? null,
        windowEnd: updated.windowEnd?.toISOString() ?? null,
        notes: updated.notes,
        updatedAt: updated.updatedAt.toISOString(),
      },
    }, { status: 200 });
  } catch (error) {
    console.error('[COLETAS_PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar coleta';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * GET /api/coletas/[id]
 * Retorna uma pickup request específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id },
      include: {
        shipment: {
          select: {
            id: true,
            platformTrackingCode: true,
            carrier: true,
            service: true,
            originCep: true,
            destinationCep: true,
            recipientName: true,
          },
        },
      },
    });

    if (!pickupRequest) {
      return NextResponse.json({ message: 'Coleta não encontrada' }, { status: 404 });
    }

    if (pickupRequest.userId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    return NextResponse.json({
      id: pickupRequest.id,
      companyId: pickupRequest.companyId,
      userId: pickupRequest.userId,
      shipmentId: pickupRequest.shipmentId,
      originCep: pickupRequest.originCep,
      originAddress: pickupRequest.originAddress,
      originCity: pickupRequest.originCity,
      originUf: pickupRequest.originUf,
      windowStart: pickupRequest.windowStart?.toISOString() ?? null,
      windowEnd: pickupRequest.windowEnd?.toISOString() ?? null,
      status: pickupRequest.status,
      notes: pickupRequest.notes,
      createdAt: pickupRequest.createdAt.toISOString(),
      updatedAt: pickupRequest.updatedAt.toISOString(),
      shipment: pickupRequest.shipment,
    }, { status: 200 });
  } catch (error) {
    console.error('[COLETAS_GET_BY_ID]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar coleta';
    return NextResponse.json({ message }, { status: 500 });
  }
}
