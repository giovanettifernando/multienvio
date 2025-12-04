import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { baixarRotuloPdf } from '@/lib/integrations/correios/prepostagem';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import bwipjs from 'bwip-js';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/packages/[id]/pdf
 * Gera PDF da etiqueta de um volume específico com header Envio Legal
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id: packageId } = await params;

    // 1. Buscar package com shipment
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        shipment: {
          select: {
            id: true,
            senderId: true,
            platformTrackingCode: true,
          },
        },
      },
    });

    if (!pkg) {
      return NextResponse.json({ message: 'Volume não encontrado' }, { status: 404 });
    }

    // 2. Verificar permissão
    if (pkg.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // 3. Verificar se tem pré-postagem
    if (!pkg.carrierPrePostageId) {
      return NextResponse.json(
        { message: 'Pré-postagem não gerada para este volume' },
        { status: 400 }
      );
    }

    console.log('[PACKAGE_PDF] Downloading Correios label:', {
      packageId,
      packageNumber: pkg.packageNumber,
      prePostageId: pkg.carrierPrePostageId,
    });

    // 4. Baixar PDF do Correios
    const rotuloResult = await baixarRotuloPdf(pkg.carrierPrePostageId);

    if (!rotuloResult.success || !rotuloResult.content) {
      return NextResponse.json(
        { message: rotuloResult.erro || 'Erro ao baixar PDF dos Correios' },
        { status: 400 }
      );
    }

    // 5. Criar PDF final com header Envio Legal
    const platformTrackingCode = pkg.shipment.platformTrackingCode || '';
    const finalPdf = await createEnvioLegalPdf(platformTrackingCode, pkg.packageNumber, [rotuloResult.content]);

    // 6. Retornar PDF
    return new NextResponse(new Uint8Array(finalPdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etiqueta_${platformTrackingCode}_vol${pkg.packageNumber}.pdf"`,
        'Content-Length': String(finalPdf.length),
      },
    });
  } catch (error) {
    console.error('[PACKAGE_PDF_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao gerar PDF do volume';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * HEAD /api/packages/[id]/pdf
 * Verifica se a etiqueta do volume está disponível
 */
export async function HEAD(request: Request, { params }: RouteParams) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return new NextResponse(null, { status: 401 });
    }

    const { id: packageId } = await params;

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: {
        shipment: {
          select: { senderId: true },
        },
      },
    });

    if (!pkg) {
      return new NextResponse(null, { status: 404 });
    }

    if (pkg.shipment.senderId !== session.userId) {
      return new NextResponse(null, { status: 403 });
    }

    if (!pkg.carrierPrePostageId) {
      return new NextResponse(null, { status: 400 });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error('[PACKAGE_PDF_HEAD]', error);
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * Cria o PDF final com header Envio Legal + código de barras + PDF Correios
 */
async function createEnvioLegalPdf(
  platformTrackingCode: string,
  packageNumber: number,
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
  } catch (e) {
    console.warn('[PACKAGE_PDF] Failed to load logo:', e);
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
    } catch (e) {
      console.warn('[PACKAGE_PDF] Failed to generate barcode:', e);
    }
  }

  // Para cada PDF do Correios
  for (const correioPdfBuffer of correioPdfBuffers) {
    let correioDoc: PDFDocument;
    try {
      correioDoc = await PDFDocument.load(correioPdfBuffer);
    } catch (e) {
      console.error('[PACKAGE_PDF] Failed to load Correios PDF:', e);
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

      // Texto "ENVIO LEGAL" + código + volume
      const codeSize = 9;
      const titleText = 'ENVIO LEGAL';
      const volumeText = `Vol. ${packageNumber}`;
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, codeSize);
      const trackingWidth = helveticaBold.widthOfTextAtSize(platformTrackingCode || '', codeSize);
      const volumeWidth = helveticaBold.widthOfTextAtSize(volumeText, codeSize);
      const gap = 8;
      const totalWidth = titleWidth + gap + trackingWidth + gap + volumeWidth;
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

      page.drawText(volumeText, {
        x: startX + titleWidth + gap + trackingWidth + gap,
        y: pageHeight - 77,
        size: codeSize,
        font: helveticaBold,
        color: rgb(0.4, 0.4, 0.4),
      });

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
