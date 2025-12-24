import { Prisma } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { cancelarPrePostagem } from '@/platform/integrations/correios';

/**
 * DELETE /api/packages/[id]/cancel
 * Cancela a pré-postagem de um package específico nos Correios
 *
 * Requisitos:
 * - Package deve pertencer a um shipment do usuário autenticado
 * - Package deve ter carrierPrePostageId (pré-postagem gerada)
 * - Pré-postagem não pode ter sido postada ainda
 */
export const DELETE = withApiHandler(async (context) => {
  const { logger } = context;
  const session = await requireUserSession(context.req);

  const { id: packageId } = await context.params;

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: {
      shipment: {
        select: {
          id: true,
          senderId: true,
          status: true,
          platformTrackingCode: true,
        },
      },
    },
  });

  if (!pkg) {
    throw new ApiError({ code: 'not_found', message: 'Volume não encontrado', status: 404 });
  }

  if (pkg.shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  if (!pkg.carrierPrePostageId) {
    throw new ApiError({
      code: 'validation_error',
      message: 'Este volume não possui pré-postagem gerada',
      status: 400,
    });
  }

  const nonCancelableStatuses = [
    'POSTED',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'RETURNED',
    'LOST',
  ];

  if (nonCancelableStatuses.includes(pkg.shipment.status)) {
    throw new ApiError({
      code: 'validation_error',
      message: 'Não é possível cancelar etiqueta de envio já postado ou em trânsito',
      status: 400,
    });
  }

  logger.info('package_cancel_start', {
    packageId,
    packageNumber: pkg.packageNumber,
    carrierPrePostageId: pkg.carrierPrePostageId,
    shipmentId: pkg.shipment.id,
  });

  const result = await cancelarPrePostagem(pkg.carrierPrePostageId);

  if (!result.success) {
    logger.error('package_cancel_correios_failed', { packageId, error: result.erro });

    throw new ApiError({
      code: 'external_api_error',
      message: result.erro || 'Erro ao cancelar pré-postagem nos Correios',
      status: 500,
    });
  }

  await prisma.package.update({
    where: { id: packageId },
    data: {
      carrierTrackingCode: null,
      carrierPrePostageId: null,
      carrierQuotePrice: null,
    },
  });

  const remainingPackages = await prisma.package.count({
    where: {
      shipmentId: pkg.shipment.id,
      carrierPrePostageId: { not: null },
    },
  });

  if (remainingPackages === 0) {
    await prisma.label.updateMany({
      where: { shipmentId: pkg.shipment.id },
      data: { status: 'canceled' },
    });

    await prisma.shipment.update({
      where: { id: pkg.shipment.id },
      data: {
        carrierTrackingCode: null,
        carrierMetadata: Prisma.DbNull,
      },
    });
  }

  logger.info('package_cancel_success', {
    packageId,
    packageNumber: pkg.packageNumber,
    remainingPackages,
  });

  return {
    data: {
      message: 'Pré-postagem cancelada com sucesso',
      package: {
        id: packageId,
        packageNumber: pkg.packageNumber,
        canceled: true,
      },
    },
  };
});
