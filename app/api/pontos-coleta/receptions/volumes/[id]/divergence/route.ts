/**
 * API Route para registrar divergência de volume
 * POST /api/pontos-coleta/receptions/volumes/[id]/divergence
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { saveBase64Image, validateBase64Image } from '@/lib/upload/file-upload';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';

const DivergenceSchema = z.object({
  divergenceType: z.enum(['DIMENSAO', 'PESO', 'DIMENSAO_E_PESO']),
  newWidth: z.number().positive().optional(),
  newHeight: z.number().positive().optional(),
  newLength: z.number().positive().optional(),
  newWeight: z.number().positive().optional(),
  notes: z.string().optional(),
  photo: z.string().optional(), // Base64 da foto (opcional)
});

type DivergenceResponse = {
  message: string;
  package: {
    id: string;
    packageNumber: number;
    hasDivergence: boolean;
    divergenceType: string | null;
  };
};

/**
 * POST /api/pontos-coleta/receptions/volumes/[id]/divergence
 * Registra divergência em um volume
 */
export const POST = withApiHandler<DivergenceResponse, { id: string }>(async ({ req, params, logger }) => {
  // Verificar autenticação do ponto de coleta
  const session = await getCollectorSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  const body = await req.json();
  const validatedData = DivergenceSchema.parse(body);

  // Buscar o volume
  const packageItem = await prisma.package.findUnique({
    where: { id: params.id },
  });

  if (!packageItem) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Volume não encontrado', status: 404 });
  }

  // Validar campos obrigatórios conforme tipo de divergência
  if (
    (validatedData.divergenceType === 'DIMENSAO' ||
      validatedData.divergenceType === 'DIMENSAO_E_PESO') &&
    (!validatedData.newWidth || !validatedData.newHeight || !validatedData.newLength)
  ) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Novas dimensões são obrigatórias para divergência de dimensão',
      status: 400,
    });
  }

  if (
    (validatedData.divergenceType === 'PESO' ||
      validatedData.divergenceType === 'DIMENSAO_E_PESO') &&
    !validatedData.newWeight
  ) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Novo peso é obrigatório para divergência de peso',
      status: 400,
    });
  }

  // Processar foto se fornecida
  let photoUrl: string | null = null;
  if (validatedData.photo) {
    // Validar foto
    const validation = validateBase64Image(validatedData.photo);
    if (!validation.valid) {
      throw new ApiError({
        code: 'VALIDATION_ERROR',
        message: validation.error || 'Foto inválida',
        status: 400,
      });
    }

    // Salvar foto
    const uploadedFile = await saveBase64Image(
      validatedData.photo,
      `divergence-pkg-${packageItem.id}`
    );
    photoUrl = uploadedFile.url;
  }

  // Registrar divergência
  const updatedPackage = await prisma.package.update({
    where: { id: params.id },
    data: {
      hasDivergence: true,
      divergenceType: validatedData.divergenceType,
      divergenceWidth: validatedData.newWidth,
      divergenceHeight: validatedData.newHeight,
      divergenceLength: validatedData.newLength,
      divergenceWeight: validatedData.newWeight,
      divergenceNotes: validatedData.notes,
      divergencePhotoUrl: photoUrl,
      divergenceRegisteredAt: new Date(),
      divergenceRegisteredBy: session.pointId,
    },
  });

  logger.info('package_divergence_registered', {
    packageId: params.id,
    pointId: session.pointId,
    divergenceType: validatedData.divergenceType,
  });

  return {
    data: {
      message: 'Divergência registrada com sucesso',
      package: {
        id: updatedPackage.id,
        packageNumber: updatedPackage.packageNumber,
        hasDivergence: updatedPackage.hasDivergence,
        divergenceType: updatedPackage.divergenceType,
      },
    },
  };
});
