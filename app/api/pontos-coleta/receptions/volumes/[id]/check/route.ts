/**
 * API Route para marcar volume como conferido
 * POST /api/pontos-coleta/receptions/volumes/[id]/check
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';

type CheckVolumeResponse = {
  message: string;
  package: {
    id: string;
    packageNumber: number;
    checkedAt: string | null;
  };
};

/**
 * POST /api/pontos-coleta/receptions/volumes/[id]/check
 * Marca volume como conferido
 */
export const POST = withApiHandler<CheckVolumeResponse, { id: string }>(async ({ req, params, logger }) => {
  // Verificar autenticação do ponto de coleta
  const session = await getCollectorSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  // Buscar o volume
  const packageItem = await prisma.package.findUnique({
    where: { id: params.id },
  });

  if (!packageItem) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Volume não encontrado', status: 404 });
  }

  // Verificar se já foi conferido
  if (packageItem.checkedAt) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Este volume já foi conferido',
      status: 400,
    });
  }

  // Marcar como conferido
  const updatedPackage = await prisma.package.update({
    where: { id: params.id },
    data: {
      checkedAt: new Date(),
      checkedBy: session.pointId,
    },
  });

  logger.info('package_checked', {
    packageId: params.id,
    pointId: session.pointId,
  });

  return {
    data: {
      message: 'Volume conferido com sucesso',
      package: {
        id: updatedPackage.id,
        packageNumber: updatedPackage.packageNumber,
        checkedAt: updatedPackage.checkedAt?.toISOString() ?? null,
      },
    },
  };
});
