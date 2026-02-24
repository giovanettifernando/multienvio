import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { prisma } from '@/platform/db/db';
import { requireUser } from '@/platform/auth/require-session';
import { generateLabelPdf } from '@/workers/pdf/handlers/label.handler';
import type { JobLogger } from '@/platform/queue/helpers';

/**
 * GET /api/labels/[id]/pdf
 * Gera PDF da etiqueta — delega ao handler compartilhado.
 */
export const GET = withApiHandlerResponse<{ id: string }>(async (context) => {
  const { req, params, logger } = context;

  try {
    const session = await requireUser(req);
    const { id } = params;

    // Verificação de permissão (query leve, sem includes pesados)
    const label = await prisma.label.findUnique({
      where: { id },
      select: { shipment: { select: { senderId: true } } },
    });

    if (!label) {
      return NextResponse.json({ message: 'Etiqueta não encontrada' }, { status: 404 });
    }

    if (label.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Adaptar logger de request (event, data?) para formato JobLogger (data, message)
    const log: JobLogger = {
      info: (obj: Record<string, unknown>, msg: string) => logger.info(msg, obj),
      warn: (obj: Record<string, unknown>, msg: string) => logger.warn(msg, obj),
      error: (obj: Record<string, unknown>, msg: string) => logger.error(msg, obj),
    };

    const { pdfBuffer, fileName } = await generateLabelPdf({ labelId: id, log });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
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
