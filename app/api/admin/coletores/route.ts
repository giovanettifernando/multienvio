/**
 * API Routes para Coletores
 * GET  /api/admin/coletores - Lista coletores com filtros
 * POST /api/admin/coletores - Cria novo coletor
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { listCollectors, createCollector } from '@/modules/collectors/application/service';
import { collectorFormSchema } from '@/modules/collectors/application/schemas';
import type { CollectorFilters, CollectorListResponse, Collector } from '@/modules/collectors/application/types';
import { z } from 'zod';

type GetCollectorsResponse = CollectorListResponse;

interface PostCollectorResponse {
  collector: Collector;
  message: string;
}

/**
 * GET /api/admin/coletores
 * Lista coletores com filtros e paginação
 */
export const GET = withApiHandler<GetCollectorsResponse>(async (context) => {
  const { req, logger } = context;

  const session = await requireAdminSession(req);

  const { searchParams } = new URL(req.url);

  // Build filters from query params
  const filters: CollectorFilters = {};

  const q = searchParams.get('q');
  if (q) filters.q = q;

  const status = searchParams.get('status');
  if (status && (status === 'active' || status === 'inactive' || status === 'blocked' || status === 'all')) {
    filters.status = status as 'active' | 'inactive' | 'blocked' | 'all';
  }

  const uf = searchParams.get('uf');
  if (uf) filters.uf = uf;

  const cidade = searchParams.get('cidade');
  if (cidade) filters.cidade = cidade;

  const page = searchParams.get('page');
  if (page) filters.page = parseInt(page, 10);

  const pageSize = searchParams.get('pageSize');
  if (pageSize) filters.pageSize = parseInt(pageSize, 10);

  const sort = searchParams.get('sort');
  if (sort && ['updated_desc', 'updated_asc', 'name_asc', 'name_desc'].includes(sort)) {
    filters.sort = sort as CollectorFilters['sort'];
  }

  const result = await listCollectors(filters);

  logger.info('admin_coletores_list', { staffId: session.staffId, total: result.total });

  return { data: result };
});

/**
 * POST /api/admin/coletores
 * Cria um novo coletor
 */
export const POST = withApiHandler<PostCollectorResponse>(async (context) => {
  const { req, logger } = context;

  const session = await requireAdminSession(req);

  const body = await req.json();

  try {
    // Validate with Zod schema
    const validatedData = collectorFormSchema.parse(body);

    const collector = await createCollector(validatedData);

    logger.info('admin_coletores_create', { staffId: session.staffId, collectorId: collector.id });

    return {
      data: { collector, message: 'Coletor criado com sucesso' },
      status: 201,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError({
        code: 'validation_error',
        message: 'Dados inválidos',
        status: 400,
        details: { errors: error.issues },
      });
    }
    throw error;
  }
});
