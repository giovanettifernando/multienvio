/**
 * Gerador de PDF para etiquetas Envio Legal
 *
 * Cria PDF final com header Envio Legal + código de barras + PDF dos Correios
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import bwipjs from 'bwip-js';
import { buildDceQrCodeUrl, isValidDceKey } from '@/shared/validation/dce';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface EnvioLegalPdfOptions {
  /** Código de rastreamento da plataforma */
  platformTrackingCode: string;
  /** Buffers dos PDFs dos Correios */
  correioPdfBuffers: Buffer[];
  /** Número do volume (opcional, para etiquetas de volume específico) */
  packageNumber?: number;
  /**
   * Chave da DC-e. Quando presente, o QR-Code de consulta é impresso no
   * cabeçalho — o manual exige que ele esteja visível na embalagem.
   */
  dceKey?: string | null;
}

/**
 * Cria o PDF final com header Envio Legal + código de barras + PDFs dos Correios
 *
 * @param options Opções de geração do PDF
 * @returns Buffer do PDF gerado
 */
export async function createEnvioLegalPdf(options: EnvioLegalPdfOptions): Promise<Buffer> {
  const { platformTrackingCode, correioPdfBuffers, packageNumber, dceKey } = options;

  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const headerHeight = 80;

  // Carregar logo
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    const logoPath = join(process.cwd(), 'public', 'images', 'logo-fundo-claro.png');
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

  // QR-Code da DC-e. Deriva só da chave (Anexo II, 3.2.1), então a plataforma
  // consegue imprimi-lo mesmo sem ter emitido o documento. Não é um DACE
  // completo — falta o protocolo de autorização, que só a SEFAZ devolve a quem
  // emitiu. É o que a fiscalização lê na caixa.
  let dceQrImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;

  if (dceKey && isValidDceKey(dceKey)) {
    try {
      const qrPng = await bwipjs.toBuffer({
        bcid: 'qrcode',
        text: buildDceQrCodeUrl(dceKey),
        scale: 3,
      });
      dceQrImage = await pdfDoc.embedPng(qrPng);
    } catch {
      // QR falhou, a etiqueta sai sem ele em vez de não sair
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
      if (logoImage) {
        // Cabe numa caixa de 70x28pt mantendo a proporção do arquivo
        const { width: logoWidth, height: logoHeight } = logoImage.scaleToFit(70, 28);
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

      // QR-Code da DC-e, à direita do bloco central do cabeçalho
      if (dceQrImage) {
        const qrSize = 52;
        const qrX = Math.min(CONTENT_WIDTH + 12, pageWidth - qrSize - 8);
        const qrY = pageHeight - qrSize - 14;

        if (qrX > CONTENT_WIDTH) {
          page.drawImage(dceQrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
          page.drawText('DC-e', {
            x: qrX + qrSize / 2 - 8,
            y: qrY - 8,
            size: 6,
            font: helveticaBold,
            color: rgb(0.35, 0.35, 0.35),
          });
        }
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
