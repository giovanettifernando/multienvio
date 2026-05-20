/**
 * POST /api/wallet/resolve-debt
 *
 * Resolve pendências financeiras (saldo negativo) da carteira
 * Cria um pagamento para cobrir o valor negativo
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { getOrCreateWallet, centsToReais } from '@/modules/wallet/application/wallet.service';
import { z } from 'zod';

const resolveDebtSchema = z.object({
  paymentMethod: z.enum(['pix', 'card'], { message: 'Método de pagamento inválido' }),
  cardId: z.string().optional(),
  amountCents: z.number().positive('Valor deve ser positivo').optional(),
});

/**
 * Resposta da API de resolução de pendências
 */
export interface ResolveDebtResponse {
  action: 'create_pix_payment' | 'create_card_payment';
  debtAmountCents: number;
  amountToPayCents: number;
  amountToPayReais: number;
  cardId?: string;
  metadata: {
    type: 'wallet_topup';
    reason: 'resolve_negative_balance';
    userId: string;
  };
}

export const POST = withApiHandler<ResolveDebtResponse>(async (context) => {
  const session = await requireUserSession(context.req);

  const body = await context.req.json();

  // Validação com Zod
  const validation = resolveDebtSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const { paymentMethod, cardId, amountCents: requestedAmount } = validation.data;

  // Buscar carteira
  const wallet = await getOrCreateWallet(session.userId);

  // Verificar se há saldo negativo
  if (wallet.availableCents >= 0) {
    throw new ApiError({
      code: 'no_debt',
      message: 'Não há pendências financeiras a resolver',
      status: 400,
    });
  }

  const debtAmount = Math.abs(wallet.availableCents);
  const amountToPay = requestedAmount || debtAmount;

  // Validar que o valor não é maior que a dívida
  if (amountToPay > debtAmount) {
    throw new ApiError({
      code: 'amount_exceeds_debt',
      message: `O valor máximo a pagar é R$ ${centsToReais(debtAmount).toFixed(2)}`,
      status: 400,
      details: { maxAmount: debtAmount },
    });
  }

  // TODO: Integrar com Pagar.me para processar o pagamento
  // Por enquanto, retornar os dados para o frontend criar o pagamento

  if (paymentMethod === 'card' && !cardId) {
    throw new ApiError({
      code: 'card_required',
      message: 'ID do cartão é obrigatório',
      status: 400,
    });
  }

  const action = paymentMethod === 'pix' ? 'create_pix_payment' as const : 'create_card_payment' as const;

  const response: ResolveDebtResponse = {
    action,
    debtAmountCents: debtAmount,
    amountToPayCents: amountToPay,
    amountToPayReais: centsToReais(amountToPay),
    cardId: paymentMethod === 'card' ? cardId : undefined,
    metadata: {
      type: 'wallet_topup',
      reason: 'resolve_negative_balance',
      userId: session.userId,
    },
  };

  return { data: response };
});
