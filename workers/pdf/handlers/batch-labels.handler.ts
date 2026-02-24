/**
 * Handler: Batch Labels PDF Generation
 *
 * Gera PDF consolidado com etiquetas de múltiplos shipments.
 * Reutiliza generateLabelPdf do label.handler para cada envio,
 * depois mescla todos em um único PDF.
 */

import { PDFDocument } from 'pdf-lib';
import { prisma } from '../../../platform/db/db';
import { generateLabelPdf } from './label.handler';
import type { JobLogger } from '../../../platform/queue/helpers';

const MAX_BATCH_SIZE = 100;

export async function generateBatchLabelsPdf(params: {
  shipmentIds: string[];
  userId: string;
  log: JobLogger;
}): Promise<{ pdfBuffer: Buffer; fileName: string }> {
  const { shipmentIds, userId, log } = params;

  if (shipmentIds.length === 0) {
    throw new Error('Nenhum envio selecionado para batch');
  }

  if (shipmentIds.length > MAX_BATCH_SIZE) {
    throw new Error(`Máximo de ${MAX_BATCH_SIZE} envios por batch. Recebidos: ${shipmentIds.length}`);
  }

  // 1. Verificar ownership e buscar labels
  const shipments = await prisma.shipment.findMany({
    where: {
      id: { in: shipmentIds },
      senderId: userId,
    },
    select: {
      id: true,
      label: { select: { id: true } },
    },
  });

  if (shipments.length !== shipmentIds.length) {
    throw new Error(`Acesso negado a um ou mais envios. Esperados: ${shipmentIds.length}, encontrados: ${shipments.length}`);
  }

  // 2. Gerar PDF de cada label individualmente
  const mergedDoc = await PDFDocument.create();
  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < shipments.length; i++) {
    const shipment = shipments[i];

    if (!shipment.label) {
      errors.push(`Envio ${shipment.id}: sem etiqueta`);
      continue;
    }

    try {
      log.info({ shipmentId: shipment.id, labelId: shipment.label.id, progress: `${i + 1}/${shipments.length}` },
        'Generating label for batch');

      const { pdfBuffer } = await generateLabelPdf({
        labelId: shipment.label.id,
        log,
      });

      // Mesclar páginas no documento consolidado
      const labelDoc = await PDFDocument.load(pdfBuffer);
      const pages = await mergedDoc.copyPages(labelDoc, labelDoc.getPageIndices());
      for (const page of pages) {
        mergedDoc.addPage(page);
      }

      successCount++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Envio ${shipment.id}: ${errorMsg}`);
      log.warn({ shipmentId: shipment.id, error: errorMsg }, 'Failed to generate label in batch — skipping');
    }
  }

  if (successCount === 0) {
    throw new Error(`Nenhuma etiqueta gerada. Erros: ${errors.join('; ')}`);
  }

  log.info({ successCount, errorCount: errors.length, total: shipments.length }, 'Batch labels PDF merged');

  const pdfBytes = await mergedDoc.save();
  const fileName = `etiquetas_lote_${shipments.length}_envios.pdf`;

  return { pdfBuffer: Buffer.from(pdfBytes), fileName };
}
