import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import prisma from '@/lib/db';

// Create or update pickup request for a shipment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

  const { id: shipmentId } = await params;

  try {
    const body = await request.json();
    const { collectorId, status, scheduleAt, notes } = body;

    // Check if shipment exists
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        senderId: true,
        originCep: true,
        destinationAddress: true,
        destinationCity: true,
        destinationState: true,
        pickupRequest: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ message: 'Envio não encontrado' }, { status: 404 });
    }

    // If pickup request already exists, update it
    if (shipment.pickupRequest) {
      const updateData: Record<string, unknown> = {};

      if (collectorId !== undefined) updateData.collectorId = collectorId;
      if (status !== undefined) updateData.status = status;
      if (scheduleAt !== undefined) updateData.scheduleAt = scheduleAt ? new Date(scheduleAt) : null;
      if (notes !== undefined) updateData.notes = notes;

      const updated = await prisma.pickupRequest.update({
        where: { id: shipment.pickupRequest.id },
        data: updateData,
        include: {
          collector: {
            select: {
              id: true,
              pfNome: true,
            },
          },
        },
      });

      // Transform collector name
      const response = {
        ...updated,
        collector: updated.collector ? {
          id: updated.collector.id,
          name: updated.collector.pfNome,
        } : null,
      };

      return NextResponse.json({
        message: 'Coleta atualizada com sucesso',
        pickupRequest: response,
      });
    }

    // Create new pickup request
    const newPickupRequest = await prisma.pickupRequest.create({
      data: {
        userId: shipment.senderId,
        shipmentId: shipment.id,
        collectorId: collectorId || null,
        status: status || 'PENDING',
        scheduleAt: scheduleAt ? new Date(scheduleAt) : null,
        notes: notes || null,
        originCep: shipment.originCep,
        originAddress: shipment.destinationAddress || null,
        originCity: shipment.destinationCity,
        originUf: shipment.destinationState,
      },
      include: {
        collector: {
          select: {
            id: true,
            pfNome: true,
          },
        },
      },
    });

    // Transform collector name
    const response = {
      ...newPickupRequest,
      collector: newPickupRequest.collector ? {
        id: newPickupRequest.collector.id,
        name: newPickupRequest.collector.pfNome,
      } : null,
    };

    return NextResponse.json({
      message: 'Coleta criada com sucesso',
      pickupRequest: response,
    });
  } catch (error) {
    console.error('Error managing pickup request:', error);
    return NextResponse.json(
      { message: 'Erro ao gerenciar coleta' },
      { status: 500 }
    );
  }
}

// Delete pickup request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

  const { id: shipmentId } = await params;

  try {
    // Find pickup request by shipment ID
    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { shipmentId },
    });

    if (!pickupRequest) {
      return NextResponse.json({ message: 'Coleta não encontrada' }, { status: 404 });
    }

    await prisma.pickupRequest.delete({
      where: { id: pickupRequest.id },
    });

    return NextResponse.json({ message: 'Coleta removida com sucesso' });
  } catch (error) {
    console.error('Error deleting pickup request:', error);
    return NextResponse.json(
      { message: 'Erro ao remover coleta' },
      { status: 500 }
    );
  }
}
