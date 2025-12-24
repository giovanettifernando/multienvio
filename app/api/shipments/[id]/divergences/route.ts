/**
 * API Route para buscar divergências de volumes de um shipment
 * GET /api/shipments/[id]/divergences
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

interface DivergenceDimensions {
  widthCm: number;
  heightCm: number;
  lengthCm: number;
}

interface ShipmentDivergence {
  id: string;
  volumeLabel: string;
  registeredDimensions?: DivergenceDimensions;
  registeredWeightKg?: number;
  type: 'DIMENSAO' | 'PESO' | 'DIMENSAO_E_PESO';
  newDimensions?: DivergenceDimensions;
  newWeightKg?: number;
  observations?: string;
  photoUrl: string | null;
  createdAt: string;
  collectorName?: string;
}

interface ShipmentDivergencesResponse {
  divergences: ShipmentDivergence[];
}

export const GET = withApiHandler<ShipmentDivergencesResponse, { id: string }>(async (context) => {
  const session = await requireUserSession(context.req);

  const { id } = await context.params;

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    select: {
      id: true,
      senderId: true,
      packages: {
        where: {
          hasDivergence: true,
        },
        select: {
          id: true,
          packageNumber: true,
          hasDivergence: true,
          divergenceType: true,
          width: true,
          height: true,
          length: true,
          weight: true,
          divergenceWidth: true,
          divergenceHeight: true,
          divergenceLength: true,
          divergenceWeight: true,
          divergenceNotes: true,
          divergencePhotoUrl: true,
          divergenceRegisteredAt: true,
          divergenceRegisteredBy: true,
        },
        orderBy: {
          packageNumber: 'asc',
        },
      },
    },
  });

  if (!shipment) {
    throw new ApiError({ code: 'not_found', message: 'Envio não encontrado', status: 404 });
  }

  if (shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  const divergences = shipment.packages.map((pkg) => {
    let type: 'DIMENSAO' | 'PESO' | 'DIMENSAO_E_PESO' = 'DIMENSAO';
    if (pkg.divergenceType === 'PESO') {
      type = 'PESO';
    } else if (pkg.divergenceType === 'DIMENSAO_E_PESO') {
      type = 'DIMENSAO_E_PESO';
    }

    return {
      id: pkg.id,
      volumeLabel: `#${pkg.packageNumber}`,
      registeredDimensions:
        pkg.width && pkg.height && pkg.length
          ? {
              widthCm: pkg.width,
              heightCm: pkg.height,
              lengthCm: pkg.length,
            }
          : undefined,
      registeredWeightKg: pkg.weight || undefined,
      type,
      newDimensions:
        pkg.divergenceWidth && pkg.divergenceHeight && pkg.divergenceLength
          ? {
              widthCm: pkg.divergenceWidth,
              heightCm: pkg.divergenceHeight,
              lengthCm: pkg.divergenceLength,
            }
          : undefined,
      newWeightKg: pkg.divergenceWeight || undefined,
      observations: pkg.divergenceNotes || undefined,
      photoUrl: pkg.divergencePhotoUrl || null,
      createdAt: pkg.divergenceRegisteredAt?.toISOString() || new Date().toISOString(),
      collectorName: pkg.divergenceRegisteredBy || undefined,
    };
  });

  return { data: { divergences } };
});
