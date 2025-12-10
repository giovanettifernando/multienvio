import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import type { CommissionItem, Paged } from '@/lib/admin/finance/types';

const mockCommissions: CommissionItem[] = [
  {
    id: 'com_001',
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-01-15T23:59:59Z',
    agentType: 'channel',
    agentName: 'Parceiro Shopify',
    amount: 5000.00,
    status: 'paid',
  },
  {
    id: 'com_002',
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-01-15T23:59:59Z',
    agentType: 'sales',
    agentName: 'João Silva',
    amount: 3500.00,
    status: 'approved',
  },
  {
    id: 'com_003',
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-01-15T23:59:59Z',
    agentType: 'channel',
    agentName: 'Integração WooCommerce',
    amount: 2800.00,
    status: 'calculated',
  },
  {
    id: 'com_004',
    periodStart: '2025-01-16T00:00:00Z',
    periodEnd: '2025-01-31T23:59:59Z',
    agentType: 'sales',
    agentName: 'Maria Santos',
    amount: 4200.00,
    status: 'calculated',
  },
  {
    id: 'com_005',
    periodStart: '2025-01-16T00:00:00Z',
    periodEnd: '2025-01-31T23:59:59Z',
    agentType: 'channel',
    agentName: 'Parceiro Vtex',
    amount: 6500.00,
    status: 'calculated',
  },
];

export const GET = withApiHandler<Paged<CommissionItem>>(async ({ req }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  if (!session.permissions.includes(AdminPermission.FINANCEIRO)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para acessar finanças',
      status: 403,
    });
  }

  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';

  let filtered = [...mockCommissions];

  if (q) {
    const lowerQ = q.toLowerCase();
    filtered = filtered.filter((c) => c.agentName.toLowerCase().includes(lowerQ));
  }

  if (status) {
    filtered = filtered.filter((c) => c.status === status);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const response: Paged<CommissionItem> = {
    items,
    page,
    pageSize,
    total,
  };

  return { data: response };
});
