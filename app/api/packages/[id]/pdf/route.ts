import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { prisma } from '@/platform/db/db';
import { requireUser } from '@/platform/auth/require-session';
import { generatePackagePdf } from '@/workers/pdf/handlers/package.handler';
import type { JobLogger } from '@/platform/queue/helpers';

/**
 * GET /api/packages/[id]/pdf
 * Gera PDF da etiqueta de um volume específico — delega ao handler compartilhado.
 */
export const GET = withApiHandlerResponse<{ id: string }>(async (context) => {
  const { req, params, logger } = context;

  try {
    const session = await requireUser(req);

    const packageId = params.id;

    // Verificação de permissão (query leve, sem includes pesados)
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      select: { shipment: { select: { senderId: true } } },
    });

    if (!pkg) {
      return NextResponse.json({ message: 'Volume não encontrado' }, { status: 404 });
    }

    if (pkg.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Adaptar logger de request (event, data?) para formato JobLogger (data, message)
    const log: JobLogger = {
      info: (obj: Record<string, unknown>, msg: string) => logger.info(msg, obj),
      warn: (obj: Record<string, unknown>, msg: string) => logger.warn(msg, obj),
      error: (obj: Record<string, unknown>, msg: string) => logger.error(msg, obj),
    };

    const { pdfBuffer, fileName } = await generatePackagePdf({ packageId, log });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
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
