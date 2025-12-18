/**
 * GET /api/wallet
 *
 * Retorna o saldo da carteira + resumo mensal + últimas transações
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { getWalletOverview } from '@/modules/wallet/application';
import type { WalletBalanceResponse } from '@/shared/types/wallet-statement';

export const GET = withApiHandler<WalletBalanceResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const result = await getWalletOverview(session.userId);

  return { data: result };
});
