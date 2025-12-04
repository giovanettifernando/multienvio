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
 *
 * IMPORTANTE: Mantém as dimensões ORIGINAIS do PDF dos Correios intactas.
 * Apenas adiciona um header acima com o código da plataforma.
 */
async function createEnvioLegalPdf(
  platformTrackingCode: string,
  correioPdfBuffers: Buffer[]
): Promise<Buffer> {
  // Criar novo documento PDF
  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Altura do header Envio Legal
  const headerHeight = 80;

  // Carregar logo Envio Legal
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    const logoPath = join(process.cwd(), 'public', 'images', 'envio-legal-logo.png');
    const logoBuffer = await readFile(logoPath);
    logoImage = await pdfDoc.embedPng(logoBuffer);
  } catch (e) {
    console.warn('[LABEL_PDF] Failed to load logo:', e);
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
      // Dimensões ORIGINAIS do PDF dos Correios - NÃO ALTERAR
      const pdfWidth = correioPage.getWidth();
      const pdfHeight = correioPage.getHeight();

      // Página final: mesma largura, altura = original + header
      const pageWidth = pdfWidth;
      const pageHeight = pdfHeight + headerHeight;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // === HEADER ENVIO LEGAL ===
      // O conteúdo visual da etiqueta Correios está no canto esquerdo (~320pt)
      const CONTENT_WIDTH = 320; // largura aproximada do conteúdo visual
      const headerCenterX = CONTENT_WIDTH / 2;

      // Logo centralizado (proporção 2000x800 = 2.5:1)
      const logoHeight = 28;
      const logoWidth = logoHeight * 2.5; // 70pt
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
      const gap = 8; // espaço entre título e código
      const totalWidth = titleWidth + gap + trackingWidth;
      const startX = headerCenterX - totalWidth / 2;

      // Texto "ENVIO LEGAL"
      page.drawText(titleText, {
        x: startX,
        y: pageHeight - 77,
        size: codeSize,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // Código de rastreio ao lado
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
      // Embeber e desenhar o PDF dos Correios SEM ALTERAÇÕES
      const [embeddedPage] = await pdfDoc.embedPdf(correioDoc, [correioPages.indexOf(correioPage)]);

      // Desenhar na parte inferior, mantendo dimensões originais
      page.drawPage(embeddedPage, {
        x: 0,
        y: 0,
        width: pdfWidth,
        height: pdfHeight,
      });
    }
  }

  // Salvar e retornar o PDF
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
