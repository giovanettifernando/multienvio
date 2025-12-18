/**
 * API Admin - Agências dos Correios
 *
 * GET /api/admin/correios-agencies
 * Lista agências do banco de dados com filtros e paginação
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { prisma } from '@/platform/db/db';
import { AdminPermission, type CorreiosAgency, type CorreiosAgencyStatus, type CorreiosAgencyType } from '@prisma/client';

type CorreiosAgenciesResponse = {
  items: CorreiosAgency[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    byStatus: Record<string, number>;
    lastSync: Date | null;
  };
};

export const GET = withApiHandler<CorreiosAgenciesResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.CONFIGURACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  // Parâmetros de query
  const { searchParams } = new URL(req.url);
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

  return {
    data: {
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
    },
  };
});
