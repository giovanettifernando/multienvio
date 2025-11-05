/**
 * API Routes para Coletores
 * GET  /api/admin/coletores - Lista coletores com filtros
 * POST /api/admin/coletores - Cria novo coletor
 */

import { NextRequest, NextResponse } from 'next/server';
import { listCollectors, createCollector } from '@/lib/collectors/service';
import { collectorFormSchema } from '@/lib/collectors/schemas';
import type { CollectorFilters } from '@/lib/collectors/types';

/**
 * GET /api/admin/coletores
 * Lista coletores com filtros e paginação
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

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

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/coletores] Error:', error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Erro ao listar coletores',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/coletores
 * Cria um novo coletor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod schema
    const validatedData = collectorFormSchema.parse(body);

    const collector = await createCollector(validatedData);

    return NextResponse.json(
      { collector, message: 'Coletor criado com sucesso' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/admin/coletores] Error:', error);

    // Zod validation error
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Erro ao criar coletor',
      },
      { status: 500 }
    );
  }
}
