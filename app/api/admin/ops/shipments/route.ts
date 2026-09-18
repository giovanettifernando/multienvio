import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission, Prisma } from '@prisma/client';
import type { Paged, OpsShipment } from '@/modules/admin/application/ops/types';
import prisma from '@/platform/db/db';

export const GET = withApiHandler<Paged<OpsShipment>>(async (context) => {
  await requireAdminSession(context.req, AdminPermission.OPERACOES);

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

  // Buscar total e shipments em paralelo para melhor performance
  const [total, shipments] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

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
    postedAt: s.postedAt?.toISOString() || null,
    deliveredAt: s.deliveredAt?.toISOString() || null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    // Label info
    labelStatus: s.label?.status || null,
    labelFileUrl: s.label?.fileUrl || null,
    labelIsPrinted: s.label?.isPrinted || false,
    // Package info
    packageCount: s.packages.length,
  }));

  const response: Paged<OpsShipment> = {
    items,
    page,
    pageSize,
    total,
  };

  return { data: response };
});
