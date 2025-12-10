import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, Prisma } from '@prisma/client';
import { canAccess } from '@/lib/auth/permissions';
import type { Paged, OpsShipment } from '@/lib/admin/ops/types';
import prisma from '@/lib/db';

export const GET = withApiHandler<Paged<OpsShipment>>(async (context) => {
  const session = await getAdminSessionFromRequest(context.req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const staffUser = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: { id: true, status: true, isSuperAdmin: true, permissions: true },
  });

  if (!staffUser || staffUser.status !== 'ACTIVE') {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  if (!canAccess(staffUser, AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Sem permissão para operações', status: 403 });
  }

  const searchParams = context.req.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const carrier = searchParams.get('carrier') || '';
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');

  // Build where clause for Prisma query
  const where: Prisma.ShipmentWhereInput = {};

  // Search query (tracking codes, recipient name, sender)
  if (q) {
    where.OR = [
      { platformTrackingCode: { contains: q, mode: 'insensitive' } },
      { carrierTrackingCode: { contains: q, mode: 'insensitive' } },
      { recipientName: { contains: q, mode: 'insensitive' } },
      { sender: { name: { contains: q, mode: 'insensitive' } } },
      { sender: { email: { contains: q, mode: 'insensitive' } } },
    ];
  }

  // Status filter
  if (status && status !== 'all') {
    where.status = status;
  }

  // Carrier filter
  if (carrier && carrier !== 'all') {
    where.carrier = carrier;
  }

  // Date range filter
  if (dateStart || dateEnd) {
    where.createdAt = {};
    if (dateStart) {
      where.createdAt.gte = new Date(dateStart);
    }
    if (dateEnd) {
      where.createdAt.lte = new Date(dateEnd);
    }
  }

  // Get total count
  const total = await prisma.shipment.count({ where });

  // Fetch shipments with related data
  const shipments = await prisma.shipment.findMany({
    where,
    include: {
      sender: {
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
      label: {
        select: {
          status: true,
          fileUrl: true,
          isPrinted: true,
        },
      },
      packages: {
        select: {
          id: true,
          hasDivergence: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // Transform to OpsShipment format
  const items: OpsShipment[] = shipments.map((s) => ({
    id: s.id,
    platformTrackingCode: s.platformTrackingCode,
    carrierTrackingCode: s.carrierTrackingCode,
    senderId: s.senderId,
    senderName: s.sender.name,
    senderEmail: s.sender.email,
    recipientId: s.recipientId,
    recipientName: s.recipientName,
    recipientPhone: s.recipientPhone,
    recipientEmail: s.recipientEmail,
    recipientDocument: s.recipientDocument,
    destinationAddress: s.destinationAddress,
    destinationNeighborhood: s.destinationNeighborhood,
    destinationCity: s.destinationCity,
    destinationState: s.destinationState,
    destinationCep: s.destinationCep,
    originCep: s.originCep,
    weight: s.weight,
    declaredValue: s.declaredValue,
    status: s.status,
    carrier: s.carrier,
    service: s.service,
    estimatedDays: s.estimatedDays,
    freightCost: s.freightCost,
    pickupFee: s.pickupFee,
    pickupPointId: s.pickupPointId,
    collectorId: s.pickupRequest?.collectorId || null,
    collectorName: s.pickupRequest?.collector?.pfNome || null,
    postedAt: s.postedAt?.toISOString() || null,
    receivedAt: s.receivedAt?.toISOString() || null,
    receivedBy: s.receivedBy,
    deliveredAt: s.deliveredAt?.toISOString() || null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    // Pickup Request info
    pickupRequestId: s.pickupRequest?.id || null,
    pickupRequestStatus: s.pickupRequest?.status || null,
    pickupScheduledAt: s.pickupRequest?.scheduleAt?.toISOString() || null,
    pickupCollectedAt: s.pickupRequest?.collectedAt?.toISOString() || null,
    pickupDeliveredToCarrierAt: s.pickupRequest?.deliveredToCarrierAt?.toISOString() || null,
    // Label info
    labelStatus: s.label?.status || null,
    labelFileUrl: s.label?.fileUrl || null,
    labelIsPrinted: s.label?.isPrinted || false,
    // Package info
    packageCount: s.packages.length,
    hasDivergence: s.packages.some((p) => p.hasDivergence),
  }));

  const response: Paged<OpsShipment> = {
    items,
    page,
    pageSize,
    total,
  };

  return { data: response };
});
