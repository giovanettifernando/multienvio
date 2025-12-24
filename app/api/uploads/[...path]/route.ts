import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { prisma } from '@/platform/db/db';

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

export const GET = withApiHandlerResponse<{ path: string[] }>(async ({ req, params, logger, requestId }) => {
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

  // SECURITY FIX F-05: Verificar autenticação
  // Try user session first (most common case), fallback to admin session
  let userSession;
  try {
    userSession = await requireUserSession(req);
  } catch {
    // If user auth fails, try admin auth
    userSession = null;
  }

  const adminSession = await getAdminSessionFromRequest(req);

  if (!userSession && !adminSession) {
    logger.warn('uploads_unauthorized_access', { path: requestedPath });
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Autenticação necessária',
      status: 401,
    });
  }

  // SECURITY FIX F-05: Verificar ownership baseado no tipo de arquivo
  if (requestedPath.startsWith('support/')) {
    // Arquivos de suporte: verificar se o usuário é dono do ticket ou admin
    const ticketId = pathSegments[1]; // support/{ticketId}/{filename}

    if (ticketId && userSession) {
      const ticket = await prisma.supportTicket.findFirst({
        where: {
          id: ticketId,
          OR: [
            { userId: userSession.userId }, // Dono do ticket
            { assignedTo: userSession.userId }, // Atendente atribuído
          ],
        },
      });

      if (!ticket && !adminSession) {
        logger.warn('uploads_forbidden_support', {
          path: requestedPath,
          ticketId,
          userId: userSession.userId,
        });
        throw new ApiError({
          code: 'FORBIDDEN',
          message: 'Acesso negado a este arquivo',
          status: 403,
        });
      }
    }
  } else if (requestedPath.startsWith('expenses/')) {
    // Arquivos de despesas: apenas admins com permissão financeira
    if (!adminSession) {
      logger.warn('uploads_forbidden_expenses', {
        path: requestedPath,
        userId: userSession?.userId,
      });
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Acesso negado - apenas administradores',
        status: 403,
      });
    }
  }

  // Construir caminho absoluto com proteção robusta contra path traversal
  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  const filePath = path.resolve(uploadsDir, requestedPath);

  // SECURITY: Verificar se o arquivo está dentro do diretório de uploads
  // Usa path.sep para evitar match parcial (ex: /uploads-other/)
  if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
    logger.warn('path_traversal_attempt', { requestedPath, resolvedPath: filePath });
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
