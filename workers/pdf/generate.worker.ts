/**
 * Worker: PDF Generate
 *
 * Fila única para geração assíncrona de todos os PDFs pesados:
 * - label: etiqueta completa (Correios multi-volume + declaração)
 * - package: etiqueta de volume individual
 * - statement: extrato de carteira
 * - batch_labels: lote de etiquetas (múltiplos envios)
 *
 * PDFs gerados ficam no filesystem em storage/generated-documents/.
 * Cleanup diário (04:00 UTC) remove documentos expirados.
 */

import { Worker, type Job } from 'bullmq';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { queueConnection } from '../../platform/queue/connection';
import { getQueue, getQueueLimiter, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, acquireLock, releaseLock, withDuration } from '../../platform/queue/helpers';
import type { PdfGenerateJobPayload, NotificationStatusJobPayload } from '../../platform/queue/types';
import { JOB_PRIORITY } from '../../platform/queue/types';
import { prisma } from '../../platform/db/db';

import { generateLabelPdf } from './handlers/label.handler';
import { generatePackagePdf } from './handlers/package.handler';
import { generateStatementPdfFromData } from './handlers/statement.handler';
import { generateBatchLabelsPdf } from './handlers/batch-labels.handler';

const LOCK_TTL_MS = 300_000; // 5 min
const STORAGE_DIR = join(process.cwd(), 'storage', 'generated-documents');

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  label: 'etiqueta',
  package: 'etiqueta de volume',
  statement: 'extrato da carteira',
  batch_labels: 'lote de etiquetas',
};

/**
 * Garante que o diretório de storage existe
 */
async function ensureStorageDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
}

async function processPdfGenerate(job: Job<PdfGenerateJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { documentType, documentId, userId } = job.data;

  log.info({ documentType, documentId }, 'Starting PDF generation');

  // 1. Idempotência: verificar se já completou
  const doc = await prisma.generatedDocument.findUnique({ where: { id: documentId } });
  if (!doc) {
    log.warn({ documentId }, 'GeneratedDocument not found — skipping');
    return;
  }
  if (doc.status === 'COMPLETED' && doc.filePath) {
    log.info({ documentId }, 'Document already generated — skipping');
    return;
  }

  // 2. Lock
  const lockKey = `lock:pdf:generate:${documentId}`;
  const acquired = await acquireLock(lockKey, LOCK_TTL_MS);
  if (!acquired) {
    log.warn({ documentId }, 'Lock already held — skipping');
    return;
  }

  try {
    // 3. Marcar como PROCESSING
    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    // 4. Dispatch por tipo
    let pdfBuffer: Buffer;
    let fileName: string;

    const { result, durationMs } = await withDuration(async () => {
      switch (job.data.documentType) {
        case 'label':
          return generateLabelPdf({ labelId: job.data.labelId, log });
        case 'package':
          return generatePackagePdf({ packageId: job.data.packageId, log });
        case 'statement':
          return generateStatementPdfFromData({
            userId: job.data.userId,
            walletId: job.data.walletId,
            dateFrom: job.data.dateFrom,
            dateTo: job.data.dateTo,
            search: job.data.search,
            log,
          });
        case 'batch_labels':
          return generateBatchLabelsPdf({
            shipmentIds: job.data.shipmentIds,
            userId: job.data.userId,
            log,
          });
      }
    });

    pdfBuffer = result.pdfBuffer;
    fileName = result.fileName;

    // 5. Salvar no filesystem
    await ensureStorageDir();
    const filePath = join(STORAGE_DIR, `${documentId}.pdf`);
    await writeFile(filePath, pdfBuffer);

    // 6. Atualizar banco
    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        filePath: `storage/generated-documents/${documentId}.pdf`,
        fileName,
        sizeBytes: pdfBuffer.length,
        completedAt: new Date(),
      },
    });

    // 7. Notificação in-app
    const notifQueue = getQueue<NotificationStatusJobPayload>(QUEUE_NAMES.NOTIFICATION_STATUS);
    await notifQueue.add('create', {
      userId,
      type: 'DOCUMENT_READY',
      title: 'Documento pronto',
      message: `Seu ${DOCUMENT_TYPE_LABELS[documentType] || 'documento'} está pronto para download.`,
      metadata: { documentId, documentType },
    }, { priority: JOB_PRIORITY.LOW });

    log.info({ documentId, documentType, sizeBytes: pdfBuffer.length, durationMs }, 'PDF generated successfully');
  } catch (error) {
    // Marcar como FAILED
    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
      },
    }).catch(() => {});

    throw error; // Re-throw para BullMQ retry
  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Cleanup de documentos expirados (TTL)
 */
async function processCleanup(job: Job): Promise<void> {
  const log = createJobLogger(job);

  log.info({}, 'Starting expired documents cleanup');

  const expired = await prisma.generatedDocument.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, filePath: true },
  });

  let deletedFiles = 0;
  for (const doc of expired) {
    if (doc.filePath) {
      try {
        const fullPath = join(process.cwd(), doc.filePath);
        await unlink(fullPath);
        deletedFiles++;
      } catch {
        // Arquivo pode já ter sido removido
      }
    }
  }

  const result = await prisma.generatedDocument.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  log.info({ deletedRows: result.count, deletedFiles }, 'Cleanup completed');
}

/**
 * Registra job repeatable de cleanup (diário às 04:00 UTC)
 */
export async function registerPdfCleanupRepeatable(): Promise<void> {
  const queue = getQueue<PdfGenerateJobPayload>(QUEUE_NAMES.PDF_GENERATE);

  await queue.upsertJobScheduler(
    'pdf-cleanup-daily',
    { pattern: '0 4 * * *' }, // 04:00 UTC diário
    {
      name: 'cleanup',
      data: { documentType: 'label', documentId: '', userId: '' } as unknown as PdfGenerateJobPayload,
      opts: { priority: JOB_PRIORITY.LOW },
    }
  );

  console.log('[PDF_GENERATE] Registered daily cleanup job (04:00 UTC)');
}

/**
 * Cria e retorna o Worker de geração de PDF
 */
export function createPdfGenerateWorker(): Worker<PdfGenerateJobPayload> {
  const limiter = getQueueLimiter(QUEUE_NAMES.PDF_GENERATE);

  const worker = new Worker<PdfGenerateJobPayload>(
    QUEUE_NAMES.PDF_GENERATE,
    async (job) => {
      // Dispatch entre geração e cleanup
      if (job.name === 'cleanup') {
        return processCleanup(job);
      }
      return processPdfGenerate(job);
    },
    {
      connection: queueConnection,
      concurrency: 3,
      limiter,
    }
  );

  worker.on('failed', (job, err) => {
    // Ignorar falhas de cleanup
    if (job?.name === 'cleanup') return;

    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 3;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'PDF generation moved to DLQ' : 'PDF generation failed, will retry',
      queue: QUEUE_NAMES.PDF_GENERATE,
      jobId: job?.id,
      documentId: job?.data?.documentId,
      documentType: job?.data?.documentType,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
