import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import type { LedgerEntry, Paged } from '@/modules/admin/application/finance/types';

/**
 * GET /api/admin/finance/reconciliation
 * Lista entradas não reconciliadas do razão
 *
 * TODO: Implementar integração real com banco de dados
 * Por enquanto retorna lista vazia aguardando implementação
 */
export const GET = withApiHandler<Paged<LedgerEntry>>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');

  // TODO: Implementar consulta real ao banco de dados
  // Por enquanto retorna lista vazia
  const items: LedgerEntry[] = [];
  const total = 0;

  const response: Paged<LedgerEntry> = {
    items,
    page,
    pageSize,
    total,
  };

  return { data: response };
});
