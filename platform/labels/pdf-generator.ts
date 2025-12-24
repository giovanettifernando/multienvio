/**
 * Gerador de PDF para etiquetas Envio Legal
 *
 * Cria PDF final com header Envio Legal + código de barras + PDF dos Correios
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import bwipjs from 'bwip-js';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface EnvioLegalPdfOptions {
  /** Código de rastreamento da plataforma */
  platformTrackingCode: string;
  /** Buffers dos PDFs dos Correios */
  correioPdfBuffers: Buffer[];
  /** Número do volume (opcional, para etiquetas de volume específico) */
  packageNumber?: number;
}

/**
 * Cria o PDF final com header Envio Legal + código de barras + PDFs dos Correios
 *
 * @param options Opções de geração do PDF
 * @returns Buffer do PDF gerado
 */
export async function createEnvioLegalPdf(options: EnvioLegalPdfOptions): Promise<Buffer> {
  const { platformTrackingCode, correioPdfBuffers, packageNumber } = options;

  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const headerHeight = 80;

  // Carregar logo Envio Legal
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    const logoPath = join(process.cwd(), 'public', 'images', 'envio-legal-logo.png');
    const logoBuffer = await readFile(logoPath);
    logoImage = await pdfDoc.embedPng(logoBuffer);
  } catch {
    // Logo não encontrado, continua sem
  }

  // Gerar código de barras (Code128)
  let barcodeImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;

  if (platformTrackingCode) {
    try {
      const barcodePng = await bwipjs.toBuffer({
        bcid: 'code128',
        text: platformTrackingCode,
        scale: 3,
        height: 10,
        includetext: false,
      });
      barcodeImage = await pdfDoc.embedPng(barcodePng);
    } catch {
      // Barcode falhou, continua sem
    }
  }

  // Para cada PDF do Correios
  for (const correioPdfBuffer of correioPdfBuffers) {
    let correioDoc: PDFDocument;
    try {
      correioDoc = await PDFDocument.load(correioPdfBuffer);
    } catch {
      continue;
    }

    const correioPages = correioDoc.getPages();

    for (const correioPage of correioPages) {
      const pdfWidth = correioPage.getWidth();
      const pdfHeight = correioPage.getHeight();

      const pageWidth = pdfWidth;
      const pageHeight = pdfHeight + headerHeight;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // === HEADER ENVIO LEGAL ===
      const CONTENT_WIDTH = 320;
      const headerCenterX = CONTENT_WIDTH / 2;

      // Logo
      const logoHeight = 28;
      const logoWidth = logoHeight * 2.5;
      if (logoImage) {
        page.drawImage(logoImage, {
          x: headerCenterX - logoWidth / 2,
          y: pageHeight - 32,
          width: logoWidth,
          height: logoHeight,
        });
      }

      // Código de barras
      if (barcodeImage) {
        const barcodeWidth = Math.min(200, CONTENT_WIDTH - 40);
        const barcodeHeight = 25;
        const barcodeX = headerCenterX - barcodeWidth / 2;
        const barcodeY = pageHeight - 62;

        page.drawImage(barcodeImage, {
          x: barcodeX,
          y: barcodeY,
          width: barcodeWidth,
          height: barcodeHeight,
        });
      }

      // Texto "ENVIO LEGAL" + código + volume (se aplicável)
      const codeSize = 9;
      const titleText = 'ENVIO LEGAL';
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, codeSize);
      const trackingWidth = helveticaBold.widthOfTextAtSize(platformTrackingCode || '', codeSize);
      const gap = 8;

      let totalWidth = titleWidth + gap + trackingWidth;
      let volumeText = '';
      let volumeWidth = 0;

      if (packageNumber !== undefined) {
        volumeText = `Vol. ${packageNumber}`;
        volumeWidth = helveticaBold.widthOfTextAtSize(volumeText, codeSize);
        totalWidth += gap + volumeWidth;
      }

      const startX = headerCenterX - totalWidth / 2;

      page.drawText(titleText, {
        x: startX,
        y: pageHeight - 77,
        size: codeSize,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      if (platformTrackingCode) {
        page.drawText(platformTrackingCode, {
          x: startX + titleWidth + gap,
          y: pageHeight - 77,
          size: codeSize,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
      }

      if (volumeText) {
        page.drawText(volumeText, {
          x: startX + titleWidth + gap + trackingWidth + gap,
          y: pageHeight - 77,
          size: codeSize,
          font: helveticaBold,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      // === CONTEÚDO DO CORREIOS ===
      const [embeddedPage] = await pdfDoc.embedPdf(correioDoc, [correioPages.indexOf(correioPage)]);

      page.drawPage(embeddedPage, {
        x: 0,
        y: 0,
        width: pdfWidth,
        height: pdfHeight,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
