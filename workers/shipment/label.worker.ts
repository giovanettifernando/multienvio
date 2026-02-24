/**
 * Worker: Label Generate (Fase 3)
 *
 * Gera ou busca etiquetas de transportadoras que não retornam
 * a etiqueta na chamada de criação do envio.
 *
 * - Correios: etiqueta já é gerada na pré-postagem (este worker apenas confirma)
 * - J&T: chama endpoint printOrder para obter PDF
 * - Loggi: etiqueta gerada junto com o shipment (confirma)
 *
 * Idempotente: se label já tem fileBase64/fileUrl, pula.
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueueLimiter, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration } from '../../platform/queue/helpers';
import type { LabelGenerateJobPayload } from '../../platform/queue/types';
import { prisma } from '../../platform/db/db';

async function processLabelGenerate(job: Job<LabelGenerateJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { shipmentId, carrier } = job.data;

  log.info({ shipmentId, carrier }, 'Starting label generation');

  // 1. Buscar label do shipment
  const label = await prisma.label.findUnique({
    where: { shipmentId },
  });

  if (!label) {
    log.warn({ shipmentId }, 'Label not found for shipment');
    return;
  }

  // 2. Idempotência: se já tem conteúdo, pular
  if (label.fileBase64 || label.fileUrl) {
    log.info({ shipmentId, labelId: label.id }, 'Label already has content — skipping');
    return;
  }

  const carrierNormalized = carrier.toLowerCase().trim();

  // 3. Gerar/buscar etiqueta por carrier
  if (carrierNormalized === 'correios') {
    // Correios: etiqueta é gerada junto com a pré-postagem
    // Se chegou aqui sem conteúdo, a pré-postagem não retornou PDF
    log.info({ shipmentId }, 'Correios label — generated during pre-postage, no separate fetch needed');
    return;
  }

  if (carrierNormalized === 'j&t' || carrierNormalized === 'jt') {
    await generateJTLabel(job, shipmentId, label.id);
    return;
  }

  if (carrierNormalized === 'loggi') {
    // Loggi: etiqueta é gerada junto com o shipment async
    log.info({ shipmentId }, 'Loggi label — generated during shipment creation');
    return;
  }

  log.info({ shipmentId, carrier }, 'Carrier does not require separate label generation');
}

/**
 * Busca etiqueta da J&T via printOrder API
 */
async function generateJTLabel(
  job: Job<LabelGenerateJobPayload>,
  shipmentId: string,
  labelId: string,
): Promise<void> {
  const log = createJobLogger(job);

  // Buscar packages com código de rastreio J&T
  const packages = await prisma.package.findMany({
    where: { shipmentId },
    select: { carrierTrackingCode: true },
  });

  const billCode = packages.find((p) => p.carrierTrackingCode)?.carrierTrackingCode;

  if (!billCode) {
    log.warn({ shipmentId }, 'No J&T bill code found — cannot generate label');
    return;
  }

  try {
    // Importar dinamicamente para evitar erro em ambientes sem a integração
    const { jtFetch } = await import('../../platform/integrations/jt/client');
    const { JT_ENDPOINTS } = await import('../../platform/integrations/jt/constants');

    const { result, durationMs } = await withDuration(() =>
      jtFetch<{ code: string; msg: string; data?: { base64?: string; url?: string } }>(
        JT_ENDPOINTS.printOrder,
        { billCode, printType: 1 },
      )
    );

    if (result.code === '200' && result.data) {
      const updateData: { fileBase64?: string; fileUrl?: string; contentType?: string } = {};

      if (result.data.base64) {
        updateData.fileBase64 = result.data.base64;
        updateData.contentType = 'application/pdf';
      } else if (result.data.url) {
        updateData.fileUrl = result.data.url;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.label.update({
          where: { id: labelId },
          data: updateData,
        });
        log.info({ shipmentId, billCode, durationMs }, 'J&T label generated successfully');
      }
    } else {
      log.warn({ shipmentId, billCode, code: result.code, msg: result.msg }, 'J&T printOrder returned non-success');
    }
  } catch (error) {
    log.error({ shipmentId, billCode, error: (error as Error).message }, 'Failed to generate J&T label');
    throw error; // Retry via BullMQ
  }
}

/**
 * Cria e retorna o Worker de geração de etiqueta
 */
export function createLabelGenerateWorker(): Worker<LabelGenerateJobPayload> {
  const limiter = getQueueLimiter(QUEUE_NAMES.LABEL_GENERATE);

  const worker = new Worker<LabelGenerateJobPayload>(
    QUEUE_NAMES.LABEL_GENERATE,
    processLabelGenerate,
    {
      connection: queueConnection,
      concurrency: 3,
      limiter,
    }
  );

  worker.on('failed', (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 3;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'Label generation moved to DLQ' : 'Label generation failed, will retry',
      queue: QUEUE_NAMES.LABEL_GENERATE,
      jobId: job?.id,
      shipmentId: job?.data?.shipmentId,
      carrier: job?.data?.carrier,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
