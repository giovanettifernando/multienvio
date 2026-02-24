/**
 * POST /api/documents/generate
 *
 * Enfileira geração assíncrona de PDF.
 * Retorna 202 com documentId para polling.
 *
 * Tipos suportados:
 * - label: etiqueta completa (todos os volumes)
 * - package: etiqueta de volume individual
 * - statement: extrato da carteira
 * - batch_labels: lote de etiquetas
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUser } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { getQueue, QUEUE_NAMES } from '@/platform/queue';
import { JOB_PRIORITY } from '@/platform/queue/types';
import type { PdfGenerateJobPayload } from '@/platform/queue/types';

const EXPIRES_IN_DAYS = 7;

type GenerateRequestBody = {
  documentType: 'label' | 'package' | 'statement' | 'batch_labels';
  labelId?: string;
  packageId?: string;
  walletId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  shipmentIds?: string[];
};

function deriveReferenceId(body: GenerateRequestBody): string {
  switch (body.documentType) {
    case 'label':
      return body.labelId || '';
    case 'package':
      return body.packageId || '';
    case 'statement':
      return body.walletId || '';
    case 'batch_labels':
      return (body.shipmentIds || []).sort().join(',');
  }
}

function buildJobPayload(
  doc: { id: string },
  userId: string,
  body: GenerateRequestBody,
): PdfGenerateJobPayload {
  switch (body.documentType) {
    case 'label':
      return {
        documentType: 'label',
        documentId: doc.id,
        userId,
        labelId: body.labelId!,
      };
    case 'package':
      return {
        documentType: 'package',
        documentId: doc.id,
        userId,
        packageId: body.packageId!,
      };
    case 'statement':
      return {
        documentType: 'statement',
        documentId: doc.id,
        userId,
        walletId: body.walletId!,
        dateFrom: body.dateFrom!,
        dateTo: body.dateTo!,
        search: body.search,
      };
    case 'batch_labels':
      return {
        documentType: 'batch_labels',
        documentId: doc.id,
        userId,
        shipmentIds: body.shipmentIds!,
      };
  }
}

export const POST = withApiHandler(async (context) => {
  const session = await requireUser(context.req);
  const body = (await context.req.json()) as GenerateRequestBody;

  // Validação
  const { documentType } = body;

  if (!['label', 'package', 'statement', 'batch_labels'].includes(documentType)) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'documentType deve ser: label, package, statement ou batch_labels',
      status: 400,
    });
  }

  if (documentType === 'label' && !body.labelId) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'labelId é obrigatório para tipo label', status: 400 });
  }
  if (documentType === 'package' && !body.packageId) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'packageId é obrigatório para tipo package', status: 400 });
  }
  if (documentType === 'statement' && !body.walletId) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'walletId é obrigatório para tipo statement', status: 400 });
  }
  if (documentType === 'batch_labels' && (!body.shipmentIds || body.shipmentIds.length === 0)) {
    throw new ApiError({ code: 'VALIDATION_ERROR', message: 'shipmentIds é obrigatório para tipo batch_labels', status: 400 });
  }

  const referenceId = deriveReferenceId(body);

  // Idempotência: verificar se já existe documento recente para a mesma referência
  const existing = await prisma.generatedDocument.findFirst({
    where: {
      userId: session.userId,
      documentType,
      referenceId,
      status: { in: ['PENDING', 'PROCESSING'] },
      createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) }, // últimos 5 min
    },
    select: { id: true, status: true, jobId: true },
  });

  if (existing) {
    return {
      data: {
        documentId: existing.id,
        jobId: existing.jobId,
        status: existing.status.toLowerCase(),
        statusUrl: `/api/documents/${existing.id}/status`,
        downloadUrl: `/api/documents/${existing.id}/download`,
      },
      status: 200,
    };
  }

  // Criar row no banco
  const doc = await prisma.generatedDocument.create({
    data: {
      userId: session.userId,
      documentType,
      referenceId,
      status: 'PENDING',
      metadata: body as import('@prisma/client').Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  // Enfileirar job
  const jobId = `pdf-${documentType}-${doc.id}`;
  const queue = getQueue<PdfGenerateJobPayload>(QUEUE_NAMES.PDF_GENERATE);
  await queue.add(documentType, buildJobPayload(doc, session.userId, body), {
    priority: documentType === 'batch_labels' ? JOB_PRIORITY.LOW : JOB_PRIORITY.MEDIUM,
    jobId,
  });

  // Atualizar doc com jobId
  await prisma.generatedDocument.update({
    where: { id: doc.id },
    data: { jobId },
  });

  return {
    data: {
      documentId: doc.id,
      jobId,
      status: 'queued',
      statusUrl: `/api/documents/${doc.id}/status`,
      downloadUrl: `/api/documents/${doc.id}/download`,
    },
    status: 202,
  };
});
