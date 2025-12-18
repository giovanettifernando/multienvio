/**
 * GET /api/wallet/transactions
 *
 * Lista as transações da carteira com filtros de data e busca + resumo do período
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { getWalletStatement } from '@/modules/wallet/application';
import type { StatementResponse } from '@/shared/types/wallet-statement';

export const GET = withApiHandler<StatementResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const { searchParams } = new URL(context.req.url);
  const dateFrom = searchParams.get('dateFrom') ?? undefined;
  const dateTo = searchParams.get('dateTo') ?? undefined;
  const search = searchParams.get('search') ?? undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const result = await getWalletStatement(
    session.userId,
    { dateFrom, dateTo, search },
    { page, limit }
  );

  return { data: result };
});
