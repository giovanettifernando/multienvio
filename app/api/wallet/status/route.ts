/**
 * GET /api/wallet/status
 *
 * Retorna o status da carteira do usuário, incluindo:
 * - Saldo disponível
 * - Se há saldo negativo (pendências financeiras)
 * - Valor da pendência (se houver)
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { getOrCreateWallet, centsToReais } from '@/modules/wallet/application/wallet.service';

export interface WalletStatusResponse {
  availableCents: number;
  availableReais: number;
  pendingCents: number;
  pendingReais: number;
  hasNegativeBalance: boolean;
  negativeAmountCents: number;
  negativeAmountReais: number;
  isBlocked: boolean;
  blockReason?: string;
}

export const GET = withApiHandler<WalletStatusResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);

  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const wallet = await getOrCreateWallet(session.userId);

  const hasNegativeBalance = wallet.availableCents < 0;
  const negativeAmountCents = hasNegativeBalance ? Math.abs(wallet.availableCents) : 0;

  const response: WalletStatusResponse = {
    availableCents: wallet.availableCents,
    availableReais: centsToReais(wallet.availableCents),
    pendingCents: wallet.pendingCents,
    pendingReais: centsToReais(wallet.pendingCents),
    hasNegativeBalance,
    negativeAmountCents,
    negativeAmountReais: centsToReais(negativeAmountCents),
    isBlocked: hasNegativeBalance,
    blockReason: hasNegativeBalance
      ? `Você possui pendências financeiras de R$ ${centsToReais(negativeAmountCents).toFixed(2)}. Regularize para continuar cotando envios.`
      : undefined,
  };

  return { data: response };
});
