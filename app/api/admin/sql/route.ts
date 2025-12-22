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

// SECURITY F-07: Lista de padrões SQL perigosos bloqueados
const DANGEROUS_SQL_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA)\b/i, description: 'DROP não é permitido' },
  { pattern: /\bTRUNCATE\s+TABLE\b/i, description: 'TRUNCATE não é permitido' },
  { pattern: /\bALTER\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA)\b/i, description: 'ALTER não é permitido' },
  { pattern: /\bDELETE\s+FROM\s+\w+\s*(;|\s*$)/i, description: 'DELETE sem WHERE não é permitido' },
  { pattern: /\bUPDATE\s+\w+\s+SET\s+[^;]+\s*(;|\s*$)(?!.*WHERE)/i, description: 'UPDATE sem WHERE não é permitido' },
  { pattern: /\bCREATE\s+(DATABASE|SCHEMA)\b/i, description: 'CREATE DATABASE/SCHEMA não é permitido' },
  { pattern: /\bGRANT\b|\bREVOKE\b/i, description: 'GRANT/REVOKE não é permitido' },
  { pattern: /\bpg_sleep\b/i, description: 'pg_sleep não é permitido' },
  { pattern: /;\s*(DROP|DELETE|TRUNCATE|ALTER)\b/i, description: 'Múltiplos comandos destrutivos não são permitidos' },
];

/**
 * SECURITY F-07: Valida query contra padrões perigosos
 */
function validateSqlQuery(query: string): { valid: boolean; error?: string } {
  const normalizedQuery = query.trim();

  for (const { pattern, description } of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      return { valid: false, error: description };
    }
  }

  return { valid: true };
}

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

  // SECURITY F-07: Validar query contra padrões perigosos
  const validation = validateSqlQuery(trimmedQuery);
  if (!validation.valid) {
    logger.warn('admin_sql_blocked', {
      adminId: authResult.user.id,
      adminEmail: authResult.user.email,
      reason: validation.error,
      queryPreview: trimmedQuery.substring(0, 200),
    });

    throw new ApiError({
      code: 'forbidden',
      message: validation.error || 'Comando SQL não permitido',
      status: 403,
    });
  }

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
