/**
 * GET /api/wallet
 *
 * Retorna o saldo da carteira + resumo mensal + últimas transações
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireUserSession } from '@/platform/auth/require-session';
import { getWalletOverview } from '@/modules/wallet/application';
import type { WalletBalanceResponse } from '@/shared/types/wallet-statement';

export const GET = withApiHandler<WalletBalanceResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  const result = await getWalletOverview(session.userId);

  return { data: result };
});
