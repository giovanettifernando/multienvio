import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { withApiHandlerResponse } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';

// Mapeamento de extensões para content-types
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export const GET = withApiHandlerResponse<{ path: string[] }>(async ({ params, logger, requestId }) => {
  const pathSegments = params.path;

  // Validar e sanitizar o caminho
  const requestedPath = pathSegments.join('/');

  // Prevenir path traversal
  if (requestedPath.includes('..') || requestedPath.includes('//')) {
    throw new ApiError({
      code: 'INVALID_PATH',
      message: 'Invalid path',
      status: 400,
    });
  }

  // Construir caminho absoluto
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const filePath = path.join(uploadsDir, requestedPath);

  // Verificar se o arquivo está dentro do diretório de uploads
  if (!filePath.startsWith(uploadsDir)) {
    throw new ApiError({
      code: 'ACCESS_DENIED',
      message: 'Access denied',
      status: 403,
    });
  }

  // Verificar se o arquivo existe
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      throw new ApiError({
        code: 'NOT_A_FILE',
        message: 'Not a file',
        status: 404,
      });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError({
      code: 'FILE_NOT_FOUND',
      message: 'File not found',
      status: 404,
    });
  }

  // Ler o arquivo
  const fileBuffer = await readFile(filePath);
  const mimeType = getMimeType(filePath);
  const fileName = path.basename(filePath);

  logger.info('uploads_file_served', { path: requestedPath, mimeType, size: fileBuffer.length });

  // Retornar o arquivo
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'public, max-age=2592000', // 30 dias
      'x-request-id': requestId,
    },
  });
});
