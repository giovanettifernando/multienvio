import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { prisma } from '@/platform/db/db';
import { getUserSessionFromRequest } from '@/modules/auth/application/user-session';
import { baixarRotuloPdf } from '@/platform/integrations/correios/prepostagem';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import bwipjs from 'bwip-js';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * GET /api/labels/[id]/pdf
 * Gera PDF da etiqueta com header Envio Legal + código de barras + PDF Correios
 */
export const GET = withApiHandlerResponse<{ id: string }>(async (context) => {
  const { req, params, logger } = context;

  try {
    const session = await getUserSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = params;

    // 1. Buscar etiqueta com dados do shipment e packages
    const label = await prisma.label.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            packages: {
              orderBy: { packageNumber: 'asc' },
            },
          },
        },
      },
    });

    if (!label) {
      return NextResponse.json({ message: 'Etiqueta não encontrada' }, { status: 404 });
    }

    // Verificar permissão
    if (label.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // 2. Obter o carrierPrePostageId do primeiro package
    const packages = label.shipment.packages;
    if (!packages.length) {
      return NextResponse.json(
        { message: 'Nenhum volume encontrado para esta etiqueta' },
        { status: 400 }
      );
    }

    // Buscar PDFs de todos os volumes
    const pdfBuffers: Buffer[] = [];
    const errors: string[] = [];

    for (const pkg of packages) {
      const prePostageId = pkg.carrierPrePostageId;

      if (!prePostageId) {
        errors.push(`Volume ${pkg.packageNumber}: Pré-postagem não gerada`);
        continue;
      }

      logger.info('label_pdf_download_start', {
        labelId: id,
        packageId: pkg.id,
        packageNumber: pkg.packageNumber,
        prePostageId,
      });

      // Baixar PDF do Correios
      const rotuloResult = await baixarRotuloPdf(prePostageId);

      if (!rotuloResult.success || !rotuloResult.content) {
        errors.push(`Volume ${pkg.packageNumber}: ${rotuloResult.erro || 'Erro ao baixar PDF'}`);
        continue;
      }

      pdfBuffers.push(rotuloResult.content);
    }

    if (pdfBuffers.length === 0) {
      return NextResponse.json(
        {
          message: 'Não foi possível gerar nenhum PDF',
          errors
        },
        { status: 400 }
      );
    }

    // 3. Criar PDF final com header Envio Legal
    const platformTrackingCode = label.shipment.platformTrackingCode || '';
    const finalPdf = await createEnvioLegalPdf(platformTrackingCode, pdfBuffers);

    logger.info('label_pdf_generated', { labelId: id, volumeCount: pdfBuffers.length });

    // 4. Retornar PDF
    return new NextResponse(new Uint8Array(finalPdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etiqueta_${platformTrackingCode}.pdf"`,
        'Content-Length': String(finalPdf.length),
      },
    });
  } catch (error) {
    logger.error('label_pdf_error', { err: error });
    const message = error instanceof Error ? error.message : 'Erro ao gerar PDF da etiqueta';
    return NextResponse.json({ message }, { status: 500 });
  }
});

/**
 * HEAD /api/labels/[id]/pdf
 * Verifica se a etiqueta está disponível para download
 */
export const HEAD = withApiHandlerResponse<{ id: string }>(async (context) => {
  const { req, params, logger } = context;

  try {
    const session = await getUserSessionFromRequest(req);
    if (!session) {
      return new NextResponse(null, { status: 401 });
    }

    const { id } = params;

    // Buscar etiqueta básica
    const label = await prisma.label.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            packages: {
              select: { carrierPrePostageId: true },
            },
          },
        },
      },
    });

    if (!label) {
      return new NextResponse(null, { status: 404 });
    }

    if (label.shipment.senderId !== session.userId) {
      return new NextResponse(null, { status: 403 });
    }

    // Verificar se tem pré-postagem gerada
    const hasPrePostage = label.shipment.packages.some(p => p.carrierPrePostageId);
    if (!hasPrePostage) {
      return NextResponse.json(
        { message: 'Pré-postagem não gerada para este envio' },
        { status: 400 }
      );
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    logger.error('label_pdf_head_error', { err: error });
    return new NextResponse(null, { status: 500 });
  }
});

/**
 * Cria o PDF final com header Envio Legal + código de barras + PDFs dos Correios
 */
async function createEnvioLegalPdf(
  platformTrackingCode: string,
  correioPdfBuffers: Buffer[]
): Promise<Buffer> {
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

  // Para cada PDF do Correios, criar uma página com header + conteúdo
  for (let i = 0; i < correioPdfBuffers.length; i++) {
    const correioPdfBuffer = correioPdfBuffers[i];

    // Carregar PDF do Correios
    let correioDoc: PDFDocument;
    try {
      correioDoc = await PDFDocument.load(correioPdfBuffer);
    } catch {
      continue;
    }

    const correioPages = correioDoc.getPages();

    // Para cada página do PDF Correios
    for (const correioPage of correioPages) {
      const pdfWidth = correioPage.getWidth();
      const pdfHeight = correioPage.getHeight();

      const pageWidth = pdfWidth;
      const pageHeight = pdfHeight + headerHeight;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // === HEADER ENVIO LEGAL ===
      const CONTENT_WIDTH = 320;
      const headerCenterX = CONTENT_WIDTH / 2;

      // Logo centralizado
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

      // Código de barras centralizado abaixo do logo
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

      // "ENVIO LEGAL" + código de rastreio na mesma linha
      const codeSize = 9;
      const titleText = 'ENVIO LEGAL';
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, codeSize);
      const trackingText = platformTrackingCode || '';
      const trackingWidth = helveticaBold.widthOfTextAtSize(trackingText, codeSize);
      const gap = 8;
      const totalWidth = titleWidth + gap + trackingWidth;
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
