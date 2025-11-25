import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

  const { id } = await params;

  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pickupRequest: {
          include: {
            collector: {
              select: {
                id: true,
                pfNome: true,
              },
            },
          },
        },
        label: true,
        packages: {
          orderBy: {
            packageNumber: 'asc',
          },
        },
        trackingEvents: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json({ message: 'Envio não encontrado' }, { status: 404 });
    }

    // Transform dates to ISO strings
    const response = {
      ...shipment,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
      postedAt: shipment.postedAt?.toISOString() || null,
      receivedAt: shipment.receivedAt?.toISOString() || null,
      deliveredAt: shipment.deliveredAt?.toISOString() || null,
      pickupRequest: shipment.pickupRequest
        ? {
            ...shipment.pickupRequest,
            collector: shipment.pickupRequest.collector
              ? {
                  id: shipment.pickupRequest.collector.id,
                  name: shipment.pickupRequest.collector.pfNome,
                }
              : null,
            createdAt: shipment.pickupRequest.createdAt.toISOString(),
            updatedAt: shipment.pickupRequest.updatedAt.toISOString(),
            windowStart: shipment.pickupRequest.windowStart?.toISOString() || null,
            windowEnd: shipment.pickupRequest.windowEnd?.toISOString() || null,
            collectedAt: shipment.pickupRequest.collectedAt?.toISOString() || null,
            deliveredToCarrierAt: shipment.pickupRequest.deliveredToCarrierAt?.toISOString() || null,
            scheduleAt: shipment.pickupRequest.scheduleAt?.toISOString() || null,
          }
        : null,
      label: shipment.label
        ? {
            ...shipment.label,
            createdAt: shipment.label.createdAt.toISOString(),
            updatedAt: shipment.label.updatedAt.toISOString(),
            printedAt: shipment.label.printedAt?.toISOString() || null,
          }
        : null,
      packages: shipment.packages.map((pkg) => ({
        ...pkg,
        createdAt: pkg.createdAt.toISOString(),
        updatedAt: pkg.updatedAt.toISOString(),
        divergenceRegisteredAt: pkg.divergenceRegisteredAt?.toISOString() || null,
        checkedAt: pkg.checkedAt?.toISOString() || null,
      })),
      trackingEvents: shipment.trackingEvents.map((evt) => ({
        ...evt,
        occurredAt: evt.occurredAt.toISOString(),
        createdAt: evt.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching shipment:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar envio' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

  const { id } = await params;

  try {
    const body = await request.json();

    // Extract allowed fields for update
    const updateData: Record<string, unknown> = {};

    // Status and carrier fields
    if (body.status !== undefined) updateData.status = body.status;
    if (body.carrier !== undefined) updateData.carrier = body.carrier;
    if (body.service !== undefined) updateData.service = body.service;
    if (body.carrierTrackingCode !== undefined)
      updateData.carrierTrackingCode = body.carrierTrackingCode;

    // Weight and values
    if (body.weight !== undefined) updateData.weight = body.weight;
    if (body.declaredValue !== undefined) updateData.declaredValue = body.declaredValue;
    if (body.freightCost !== undefined) updateData.freightCost = body.freightCost;
    if (body.pickupFee !== undefined) updateData.pickupFee = body.pickupFee;
    if (body.estimatedDays !== undefined) updateData.estimatedDays = body.estimatedDays;

    // Recipient fields
    if (body.recipientName !== undefined) updateData.recipientName = body.recipientName;
    if (body.recipientPhone !== undefined) updateData.recipientPhone = body.recipientPhone;
    if (body.recipientEmail !== undefined) updateData.recipientEmail = body.recipientEmail;
    if (body.recipientDocument !== undefined)
      updateData.recipientDocument = body.recipientDocument;

    // Destination address fields
    if (body.destinationAddress !== undefined)
      updateData.destinationAddress = body.destinationAddress;
    if (body.destinationNeighborhood !== undefined)
      updateData.destinationNeighborhood = body.destinationNeighborhood;
    if (body.destinationCity !== undefined) updateData.destinationCity = body.destinationCity;
    if (body.destinationState !== undefined)
      updateData.destinationState = body.destinationState;
    if (body.destinationCep !== undefined) updateData.destinationCep = body.destinationCep;

    // Pickup point
    if (body.pickupPointId !== undefined) updateData.pickupPointId = body.pickupPointId;

    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Envio atualizado com sucesso',
      shipment: updatedShipment,
    });
  } catch (error) {
    console.error('Error updating shipment:', error);
    return NextResponse.json(
      { message: 'Erro ao atualizar envio' },
      { status: 500 }
    );
  }
}
