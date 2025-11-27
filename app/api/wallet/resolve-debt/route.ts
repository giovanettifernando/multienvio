/**
 * POST /api/wallet/resolve-debt
 *
 * Resolve pendências financeiras (saldo negativo) da carteira
 * Cria um pagamento para cobrir o valor negativo
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getOrCreateWallet, centsToReais } from '@/lib/wallet/wallet.service';
import { z } from 'zod';

const resolveDebtSchema = z.object({
  // Método de pagamento: 'pix' ou 'card'
  paymentMethod: z.enum(['pix', 'card']),
  // ID do cartão salvo (se paymentMethod === 'card')
  cardId: z.string().optional(),
  // Valor a pagar (opcional - se não informado, usa o valor total da dívida)
  amountCents: z.number().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = resolveDebtSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { paymentMethod, cardId, amountCents: requestedAmount } = validation.data;

    // Buscar carteira
    const wallet = await getOrCreateWallet(session.userId);

    // Verificar se há saldo negativo
    if (wallet.availableCents >= 0) {
      return NextResponse.json(
        { message: 'Não há pendências financeiras a resolver' },
        { status: 400 }
      );
    }

    const debtAmount = Math.abs(wallet.availableCents);
    const amountToPay = requestedAmount || debtAmount;

    // Validar que o valor não é maior que a dívida
    if (amountToPay > debtAmount) {
      return NextResponse.json(
        {
          message: `O valor máximo a pagar é R$ ${centsToReais(debtAmount).toFixed(2)}`,
          maxAmount: debtAmount,
        },
        { status: 400 }
      );
    }

    // TODO: Integrar com MercadoPago para processar o pagamento
    // Por enquanto, retornar os dados para o frontend criar o pagamento

    if (paymentMethod === 'pix') {
      // Retornar dados para criar pagamento PIX
      return NextResponse.json({
        action: 'create_pix_payment',
        debtAmountCents: debtAmount,
        amountToPayCents: amountToPay,
        amountToPayReais: centsToReais(amountToPay),
        metadata: {
          type: 'wallet_topup',
          reason: 'resolve_negative_balance',
          userId: session.userId,
        },
      });
    }

    if (paymentMethod === 'card') {
      if (!cardId) {
        return NextResponse.json(
          { message: 'ID do cartão é obrigatório' },
          { status: 400 }
        );
      }

      // Retornar dados para criar pagamento com cartão
      return NextResponse.json({
        action: 'create_card_payment',
        debtAmountCents: debtAmount,
        amountToPayCents: amountToPay,
        amountToPayReais: centsToReais(amountToPay),
        cardId,
        metadata: {
          type: 'wallet_topup',
          reason: 'resolve_negative_balance',
          userId: session.userId,
        },
      });
    }

    return NextResponse.json(
      { message: 'Método de pagamento não suportado' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[WALLET_RESOLVE_DEBT_POST]', error);
    return NextResponse.json(
      { message: 'Erro ao resolver pendências' },
      { status: 500 }
    );
  }
}
