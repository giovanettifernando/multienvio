/**
 * API Admin - Agências dos Correios
 *
 * GET /api/admin/correios-agencies
 * Lista agências do banco de dados com filtros e paginação
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission, type CorreiosAgencyStatus, type CorreiosAgencyType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await requireAdminUser(request, AdminPermission.CONFIGURACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Parâmetros de query
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const uf = searchParams.get('uf') || undefined;
    const municipio = searchParams.get('municipio') || undefined;
    const status = searchParams.get('status') as CorreiosAgencyStatus | undefined;
    const tipoUnidade = searchParams.get('tipoUnidade') as CorreiosAgencyType | undefined;
    const q = searchParams.get('q') || undefined;

    // Montar filtro
    const where: {
      uf?: string;
      municipio?: { contains: string; mode: 'insensitive' };
      status?: CorreiosAgencyStatus;
      tipoUnidadeSigla?: CorreiosAgencyType;
      OR?: Array<{
        nome?: { contains: string; mode: 'insensitive' };
        municipio?: { contains: string; mode: 'insensitive' };
        bairro?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    if (uf) {
      where.uf = uf;
    }

    if (municipio) {
      where.municipio = { contains: municipio, mode: 'insensitive' };
    }

    if (status) {
      where.status = status;
    }

    if (tipoUnidade) {
      where.tipoUnidadeSigla = tipoUnidade;
    }

    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { municipio: { contains: q, mode: 'insensitive' } },
        { bairro: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Buscar agências
    const [agencies, total] = await Promise.all([
      prisma.correiosAgency.findMany({
        where,
        orderBy: [{ uf: 'asc' }, { municipio: 'asc' }, { nome: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.correiosAgency.count({ where }),
    ]);

    // Estatísticas
    const stats = await prisma.correiosAgency.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const lastSync = await prisma.correiosAgency.findFirst({
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    });

    return NextResponse.json({
      items: agencies,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats: {
        byStatus: stats.reduce(
          (acc, s) => ({ ...acc, [s.status]: s._count.id }),
          {} as Record<string, number>
        ),
        lastSync: lastSync?.syncedAt || null,
      },
    });
  } catch (error) {
    console.error('[CORREIOS_AGENCIES_API] Erro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
