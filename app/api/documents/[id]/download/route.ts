/**
 * GET /api/documents/[id]/download
 *
 * Download do PDF gerado. Lê o arquivo do filesystem
 * e retorna como binário.
 */

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { requireUser } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

export const GET = withApiHandlerResponse<{ id: string }>(async (context) => {
  const session = await requireUser(context.req);
  const { id } = context.params;

  const doc = await prisma.generatedDocument.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      filePath: true,
      fileName: true,
      contentType: true,
    },
  });

  if (!doc) {
    return NextResponse.json({ message: 'Documento não encontrado' }, { status: 404 });
  }

  if (doc.userId !== session.userId) {
    return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
  }

  if (doc.status !== 'COMPLETED' || !doc.filePath) {
    return NextResponse.json({ message: 'Documento ainda não está pronto' }, { status: 404 });
  }

  try {
    const fullPath = join(process.cwd(), doc.filePath);
    const buffer = await readFile(fullPath);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': doc.contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="${doc.fileName || 'document.pdf'}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ message: 'Arquivo não encontrado no servidor' }, { status: 404 });
  }
});
