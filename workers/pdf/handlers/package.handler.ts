/**
 * Handler: Package PDF Generation
 *
 * Gera PDF de etiqueta para um volume individual.
 * Extrai lógica de app/api/packages/[id]/pdf/route.ts.
 */

import { prisma } from '../../../platform/db/db';
import { baixarRotuloPdf } from '../../../platform/integrations/correios/prepostagem';
import { createMultienvioPdf } from '../../../platform/labels/pdf-generator';
import type { JobLogger } from '../../../platform/queue/helpers';

export async function generatePackagePdf(params: {
  packageId: string;
  log: JobLogger;
}): Promise<{ pdfBuffer: Buffer; fileName: string }> {
  const { packageId, log } = params;

  // 1. Buscar package com shipment
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: {
      shipment: {
        select: {
          id: true,
          senderId: true,
          platformTrackingCode: true,
          status: true,
          paymentMethod: true,
        },
      },
    },
  });

  if (!pkg) {
    throw new Error(`Volume ${packageId} não encontrado`);
  }

  if (!pkg.shipment.paymentMethod) {
    throw new Error('Envio não pago. Finalize o pagamento antes de gerar a etiqueta.');
  }

  const status = pkg.shipment.status;
  if (status.includes('CANCEL') || status.includes('EXPIRED') || status.includes('RETURNED')) {
    throw new Error(`Não é possível gerar etiqueta de envio com status ${status}`);
  }

  if (!pkg.carrierPrePostageId) {
    throw new Error('Pré-postagem não gerada para este volume');
  }

  log.info({ packageId, packageNumber: pkg.packageNumber, prePostageId: pkg.carrierPrePostageId },
    'Downloading Correios PDF for package');

  // 2. Baixar PDF do Correios
  const rotuloResult = await baixarRotuloPdf(pkg.carrierPrePostageId);

  if (!rotuloResult.success || !rotuloResult.content) {
    throw new Error(rotuloResult.erro || 'Erro ao baixar PDF dos Correios');
  }

  // 3. Criar PDF com header Multienvio
  const platformTrackingCode = pkg.shipment.platformTrackingCode || '';
  const pdfBuffer = await createMultienvioPdf({
    platformTrackingCode,
    correioPdfBuffers: [rotuloResult.content],
    packageNumber: pkg.packageNumber,
  });

  log.info({ packageId, packageNumber: pkg.packageNumber }, 'Package PDF generated');

  const fileName = `etiqueta_${platformTrackingCode}_vol${pkg.packageNumber}.pdf`;
  return { pdfBuffer, fileName };
}
