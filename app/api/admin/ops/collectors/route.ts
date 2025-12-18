import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';

interface CollectorItem {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  uf: string | null;
}

export const GET = withApiHandler<CollectorItem[]>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.OPERACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  // Fetch only active collectors
  const collectors = await prisma.collector.findMany({
    where: {
      status: 'ACTIVE',
    },
    select: {
      id: true,
      pfNome: true,
      pfCelular: true,
      pfCidade: true,
      pfUf: true,
    },
    orderBy: {
      pfNome: 'asc',
    },
  });

  // Transform to simpler format
  const items = collectors.map((c) => ({
    id: c.id,
    name: c.pfNome,
    phone: c.pfCelular,
    city: c.pfCidade,
    uf: c.pfUf,
  }));

  return { data: items };
});
