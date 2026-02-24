/**
 * GET /api/documents/[id]/status
 *
 * Polling endpoint para verificar status de geração de PDF.
 * Retorna status + metadados do documento.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUser } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

export const GET = withApiHandler<unknown, { id: string }>(async (context) => {
  const session = await requireUser(context.req);
  const { id } = context.params;

  const doc = await prisma.generatedDocument.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      documentType: true,
      fileName: true,
      sizeBytes: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
  });

  if (!doc) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Documento não encontrado', status: 404 });
  }

  if (doc.userId !== session.userId) {
    throw new ApiError({ code: 'FORBIDDEN', message: 'Acesso negado', status: 403 });
  }

  return {
    data: {
      id: doc.id,
      status: doc.status.toLowerCase(),
      documentType: doc.documentType,
      fileName: doc.fileName,
      sizeBytes: doc.sizeBytes,
      errorMessage: doc.errorMessage,
      createdAt: doc.createdAt,
      completedAt: doc.completedAt,
      downloadUrl: doc.status === 'COMPLETED' ? `/api/documents/${doc.id}/download` : null,
    },
  };
});
