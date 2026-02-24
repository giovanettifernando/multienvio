/**
 * Handler: Label PDF Generation
 *
 * Extrai a lógica de geração de PDF de etiqueta de app/api/labels/[id]/pdf/route.ts.
 * Gera PDF com header Envio Legal + códigos de barras + PDFs dos Correios.
 * Opcionalmente anexa Declaração de Conteúdo.
 */

import { PDFDocument } from 'pdf-lib';
import { prisma } from '../../../platform/db/db';
import { baixarRotuloPdf } from '../../../platform/integrations/correios/prepostagem';
import { createEnvioLegalPdf } from '../../../platform/labels/pdf-generator';
import {
  generateDeclaracaoConteudoPdf,
  type DeclaracaoConteudoPayload,
} from '../../../shared/docs/correios/declaracao-conteudo-pdf';
import type { JobLogger } from '../../../platform/queue/helpers';
import { withRetry, CORREIOS_RETRY_CONFIG } from '../../../shared/utils/retry';
import { formatEndereco } from '../../../shared/utils/address';
import { extractDeclarationItems, type ShipmentDocument } from '../../../shared/docs/correios/declaration-items';

async function baixarRotuloPdfComRetry(
  prePostageId: string,
  log: JobLogger
): Promise<{ success: boolean; content?: Buffer; erro?: string }> {
  return withRetry(
    async () => {
      const result = await baixarRotuloPdf(prePostageId);
      if (!result.success || !result.content) {
        throw new Error(result.erro || 'Erro ao baixar PDF dos Correios');
      }
      return result;
    },
    {
      ...CORREIOS_RETRY_CONFIG,
      onRetry: (attempt, delay, error) => {
        log.warn({ prePostageId, attempt, delayMs: delay, error: error instanceof Error ? error.message : String(error) },
          'Retrying Correios PDF download');
      },
    }
  ).catch((error) => ({
    success: false,
    erro: error instanceof Error ? error.message : 'Erro ao baixar PDF após múltiplas tentativas',
  }));
}

export async function generateLabelPdf(params: {
  labelId: string;
  log: JobLogger;
}): Promise<{ pdfBuffer: Buffer; fileName: string }> {
  const { labelId, log } = params;

  // 1. Buscar label + shipment + packages + sender
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    include: {
      shipment: {
        include: {
          packages: {
            orderBy: { packageNumber: 'asc' },
          },
          sender: {
            include: {
              addresses: {
                where: { isDefault: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!label) {
    throw new Error(`Label ${labelId} não encontrada`);
  }

  const packages = label.shipment.packages;
  if (!packages.length) {
    throw new Error(`Nenhum volume encontrado para a etiqueta ${labelId}`);
  }

  // 2. Baixar PDFs de todos os volumes
  const pdfBuffers: Buffer[] = [];
  const errors: string[] = [];

  for (const pkg of packages) {
    const prePostageId = pkg.carrierPrePostageId;

    if (!prePostageId) {
      errors.push(`Volume ${pkg.packageNumber}: Pré-postagem não gerada`);
      continue;
    }

    log.info({ labelId, packageId: pkg.id, packageNumber: pkg.packageNumber, prePostageId },
      'Downloading Correios PDF');

    const rotuloResult = await baixarRotuloPdfComRetry(prePostageId, log);

    if (!rotuloResult.success || !rotuloResult.content) {
      errors.push(`Volume ${pkg.packageNumber}: ${rotuloResult.erro || 'Erro ao baixar PDF'}`);
      continue;
    }

    pdfBuffers.push(rotuloResult.content);
  }

  if (pdfBuffers.length === 0) {
    throw new Error(`Não foi possível gerar nenhum PDF. Erros: ${errors.join('; ')}`);
  }

  // 3. Criar PDF com header Envio Legal
  const platformTrackingCode = label.shipment.platformTrackingCode || '';
  let finalPdf: Buffer | Uint8Array = await createEnvioLegalPdf({
    platformTrackingCode,
    correioPdfBuffers: pdfBuffers,
  });

  log.info({ labelId, volumeCount: pdfBuffers.length }, 'Label PDF composed');

  // 4. Anexar Declaração de Conteúdo (se aplicável)
  const shipmentDoc = label.shipment.document as ShipmentDocument | null;

  if (shipmentDoc?.type === 'DECLARACAO') {
    try {
      const itens = extractDeclarationItems(shipmentDoc);

      if (itens.length > 0) {
        const sender = label.shipment.sender;
        const senderAddress = sender?.addresses?.[0];

        if (sender && senderAddress) {
          const pesoTotalKg = packages.reduce((sum, pkg) => sum + Number(pkg.weight), 0);

          const declaracaoPayload: DeclaracaoConteudoPayload = {
            remetente: {
              nome: sender.razaoSocial || sender.name || '—',
              documento: sender.cnpj || sender.cpf || null,
              endereco: formatEndereco(senderAddress),
              cidadeUf: `${senderAddress.cidade} - ${senderAddress.uf}`,
              cep: label.shipment.originCep,
            },
            destinatario: {
              nome: label.shipment.recipientName || '—',
              documento: label.shipment.recipientDocument || null,
              endereco: label.shipment.destinationAddress || '—',
              cidadeUf: `${label.shipment.destinationCity} - ${label.shipment.destinationState}`,
              cep: label.shipment.destinationCep,
            },
            itens,
            pesoTotalKg,
          };

          const declaracaoPdfBytes = await generateDeclaracaoConteudoPdf(declaracaoPayload);

          const labelPdfDoc = await PDFDocument.load(finalPdf);
          const declaracaoPdfDoc = await PDFDocument.load(declaracaoPdfBytes);
          const declaracaoPages = await labelPdfDoc.copyPages(declaracaoPdfDoc, declaracaoPdfDoc.getPageIndices());

          for (const page of declaracaoPages) {
            labelPdfDoc.addPage(page);
          }

          finalPdf = Buffer.from(await labelPdfDoc.save());
          log.info({ labelId, itemCount: itens.length, pesoTotalKg }, 'Declaration appended to label PDF');
        }
      }
    } catch (declaracaoError) {
      log.warn({ labelId, error: declaracaoError instanceof Error ? declaracaoError.message : String(declaracaoError) },
        'Failed to append declaration — continuing without it');
    }
  }

  const fileName = `etiqueta_${platformTrackingCode || labelId}.pdf`;
  return { pdfBuffer: Buffer.from(finalPdf), fileName };
}
