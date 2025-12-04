import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserSessionFromRequest } from '@/lib/auth/user-session';
import { baixarRotuloPdf } from '@/lib/integrations/correios/prepostagem';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import bwipjs from 'bwip-js';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/labels/[id]/pdf
 * Gera PDF da etiqueta com header Envio Legal + código de barras + PDF Correios
 *
 * O PDF final tem a seguinte estrutura:
 * ┌─────────────────────────────────┐
 * │  [LOGO]  ENVIO LEGAL            │  ← Header Envio Legal
 * ├─────────────────────────────────┤
 * │  ║║║║║║║║║║║║║║║║║║║║║║║║║║║║  │  ← Código de barras (platformTrackingCode)
 * │    EL1764847861719P283D         │  ← Texto do código
 * ├─────────────────────────────────┤
 * │                                 │
 * │    [PDF ORIGINAL CORREIOS]      │  ← Conteúdo do rótulo Correios
 * │                                 │
 * └─────────────────────────────────┘
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

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
    // Para multi-volume, cada package tem seu próprio ID
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

      console.log('[LABEL_PDF] Downloading Correios label:', {
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
    console.error('[LABEL_PDF_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao gerar PDF da etiqueta';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * HEAD /api/labels/[id]/pdf
 * Verifica se a etiqueta está disponível para download
 */
export async function HEAD(request: Request, { params }: RouteParams) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return new NextResponse(null, { status: 401 });
    }

    const { id } = await params;

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
    console.error('[LABEL_PDF_HEAD]', error);
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * Cria o PDF final com header Envio Legal + código de barras + PDFs dos Correios
 */
async function createEnvioLegalPdf(
  platformTrackingCode: string,
  correioPdfBuffers: Buffer[]
): Promise<Buffer> {
  // Criar novo documento PDF
  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Altura do header Envio Legal (compacto)
  const headerHeight = 70;

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
      console.warn('[LABEL_PDF] Failed to generate barcode:', e);
    }
  }

  // Para cada PDF do Correios, criar uma página com header + conteúdo
  for (let i = 0; i < correioPdfBuffers.length; i++) {
    const correioPdfBuffer = correioPdfBuffers[i];

    // Carregar PDF do Correios
    let correioDoc: PDFDocument;
    try {
      correioDoc = await PDFDocument.load(correioPdfBuffer);
    } catch (e) {
      console.error('[LABEL_PDF] Failed to load Correios PDF:', e);
      continue;
    }

    const correioPages = correioDoc.getPages();

    // Para cada página do PDF Correios
    for (const correioPage of correioPages) {
      // Usar o tamanho da etiqueta Correios como base
      const correioWidth = correioPage.getWidth();
      const correioHeight = correioPage.getHeight();

      // Página final: mesma largura, altura = header + etiqueta Correios
      const pageWidth = correioWidth;
      const pageHeight = correioHeight + headerHeight;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // === HEADER ENVIO LEGAL (fundo branco, sem cor) ===

      // Texto "ENVIO LEGAL" centralizado (preto)
      const titleText = 'ENVIO LEGAL';
      const titleSize = 14;
      const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleSize);
      page.drawText(titleText, {
        x: (pageWidth - titleWidth) / 2,
        y: pageHeight - 18,
        size: titleSize,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // Código de barras centralizado
      if (barcodeImage) {
        const barcodeWidth = Math.min(200, pageWidth - 40);
        const barcodeHeight = 25;
        const barcodeX = (pageWidth - barcodeWidth) / 2;
        const barcodeY = pageHeight - 50;

        page.drawImage(barcodeImage, {
          x: barcodeX,
          y: barcodeY,
          width: barcodeWidth,
          height: barcodeHeight,
        });
      }

      // Texto do código de rastreio centralizado abaixo do barcode
      if (platformTrackingCode) {
        const codeSize = 10;
        const textWidth = helveticaBold.widthOfTextAtSize(platformTrackingCode, codeSize);
        page.drawText(platformTrackingCode, {
          x: (pageWidth - textWidth) / 2,
          y: pageHeight - 65,
          size: codeSize,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });
      }

      // === CONTEÚDO DO CORREIOS ===
      // Copiar a página do Correios para o documento (na parte inferior)
      const [embeddedPage] = await pdfDoc.embedPdf(correioDoc, [correioPages.indexOf(correioPage)]);

      // Desenhar a etiqueta Correios na parte inferior (mantendo tamanho original)
      page.drawPage(embeddedPage, {
        x: 0,
        y: 0,
        width: correioWidth,
        height: correioHeight,
      });
    }
  }

  // Salvar e retornar o PDF
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
