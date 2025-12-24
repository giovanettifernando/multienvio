import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { prisma } from '@/platform/db/db';
import { requireUser } from '@/platform/auth/require-session';
import { baixarRotuloPdf } from '@/platform/integrations/correios/prepostagem';
import { createEnvioLegalPdf } from '@/platform/labels/pdf-generator';

/**
 * GET /api/labels/[id]/pdf
 * Gera PDF da etiqueta com header Envio Legal + código de barras + PDF Correios
 */
export const GET = withApiHandlerResponse<{ id: string }>(async (context) => {
  const { req, params, logger } = context;

  try {
    const session = await requireUser(req);

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
    const finalPdf = await createEnvioLegalPdf({
      platformTrackingCode,
      correioPdfBuffers: pdfBuffers,
    });

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
    const session = await requireUser(req);

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
