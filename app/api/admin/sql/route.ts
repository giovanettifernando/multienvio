/**
 * API route para execução de SQL pelos administradores
 * POST /api/admin/sql
 *
 * ATENÇÃO: Esta é uma funcionalidade perigosa que só deve ser usada por
 * administradores autorizados. Todas as execuções são logadas.
 */

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { requireAdminUser } from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { z } from 'zod';

const sqlRequestSchema = z.object({
  query: z.string().min(1, 'Query é obrigatória').max(10000, 'Query muito longa'),
});

interface SqlResponse {
  success: boolean;
  data?: unknown[];
  rowCount?: number;
  error?: string;
  executionTimeMs?: number;
}

export const POST = withApiHandler<SqlResponse>(async (context) => {
  const { req, logger } = context;

  // Verificar autenticação e permissão CONFIGURACOES
  const authResult = await requireAdminUser(req, AdminPermission.CONFIGURACOES);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'unauthorized',
      message: 'Não autenticado ou sem permissão',
      status: 401,
    });
  }

  const body = await req.json();
  const parsed = sqlRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'validation_error',
      message: 'Query inválida',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { query } = parsed.data;
  const trimmedQuery = query.trim();

  // Log da execução para auditoria
  logger.info('admin_sql_execute', {
    adminId: authResult.user.id,
    adminEmail: authResult.user.email,
    queryPreview: trimmedQuery.substring(0, 200),
    queryLength: trimmedQuery.length,
  });

  const startTime = Date.now();

  try {
    // Executar query usando $queryRawUnsafe
    // NOTA: Isso é intencionalmente "unsafe" pois o admin precisa executar qualquer SQL
    const result = await prisma.$queryRawUnsafe(trimmedQuery);

    const executionTimeMs = Date.now() - startTime;

    // Converter BigInt para string para serialização JSON
    const serializedResult = JSON.parse(
      JSON.stringify(result, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    logger.info('admin_sql_success', {
      adminId: authResult.user.id,
      executionTimeMs,
      rowCount: Array.isArray(serializedResult) ? serializedResult.length : 1,
    });

    return {
      data: {
        success: true,
        data: Array.isArray(serializedResult) ? serializedResult : [serializedResult],
        rowCount: Array.isArray(serializedResult) ? serializedResult.length : 1,
        executionTimeMs,
      },
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    logger.error('admin_sql_error', {
      adminId: authResult.user.id,
      error: errorMessage,
      executionTimeMs,
    });

    // Retornar erro mas com status 200 para o frontend tratar
    return {
      data: {
        success: false,
        error: errorMessage,
        executionTimeMs,
      },
    };
  }
});
