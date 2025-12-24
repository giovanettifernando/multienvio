import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { prisma } from '@/platform/db/db';
import { requireUser } from '@/platform/auth/require-session';
import { baixarRotuloPdf } from '@/platform/integrations/correios/prepostagem';
import { createEnvioLegalPdf } from '@/platform/labels/pdf-generator';

/**
 * GET /api/packages/[id]/pdf
 * Gera PDF da etiqueta de um volume específico com header Envio Legal
 */
export const GET = withApiHandlerResponse<{ id: string }>(async (context) => {
  const { req, params, logger } = context;

  try {
    const session = await requireUser(req);

    const packageId = params.id;

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
      return NextResponse.json({ message: 'Volume não encontrado' }, { status: 404 });
    }

    // 2. Verificar permissão
    if (pkg.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // 3. SECURITY: Verificar se o envio foi pago
    if (!pkg.shipment.paymentMethod) {
      logger.warn('pdf_download_unpaid', { packageId, shipmentId: pkg.shipment.id });
      return NextResponse.json(
        { message: 'Envio não pago. Finalize o pagamento antes de baixar a etiqueta.' },
        { status: 402 }
      );
    }

    // 4. SECURITY: Verificar se o envio não está cancelado/expirado
    const status = pkg.shipment.status;
    if (status.includes('CANCEL') || status.includes('EXPIRED') || status.includes('RETURNED')) {
      logger.warn('pdf_download_invalid_status', { packageId, shipmentId: pkg.shipment.id, status });
      return NextResponse.json(
        { message: 'Não é possível baixar etiqueta de envio cancelado ou expirado.' },
        { status: 400 }
      );
    }

    // 5. Verificar se tem pré-postagem
    if (!pkg.carrierPrePostageId) {
      return NextResponse.json(
        { message: 'Pré-postagem não gerada para este volume' },
        { status: 400 }
      );
    }

    logger.info('package_pdf_download_start', {
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
    const finalPdf = await createEnvioLegalPdf({
      platformTrackingCode,
      correioPdfBuffers: [rotuloResult.content],
      packageNumber: pkg.packageNumber,
    });

    logger.info('package_pdf_generated', { packageId, packageNumber: pkg.packageNumber });

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
    logger.error('package_pdf_error', { err: error });
    const message = error instanceof Error ? error.message : 'Erro ao gerar PDF do volume';
    return NextResponse.json({ message }, { status: 500 });
  }
});

/**
 * HEAD /api/packages/[id]/pdf
 * Verifica se a etiqueta do volume está disponível
 */
export const HEAD = withApiHandlerResponse<{ id: string }>(async (context) => {
  const { req, params, logger } = context;

  try {
    const session = await requireUser(req);

    const packageId = params.id;

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
    logger.error('package_pdf_head_error', { err: error });
    return new NextResponse(null, { status: 500 });
  }
});
