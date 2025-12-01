/**
 * GET /api/wallet/status
 *
 * Retorna o status da carteira do usuário, incluindo:
 * - Saldo disponível
 * - Se há saldo negativo (pendências financeiras)
 * - Valor da pendência (se houver)
 */


import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getOrCreateWallet, centsToReais } from '@/lib/wallet/wallet.service';

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

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('[WALLET_STATUS_GET]', error);
    return NextResponse.json(
      { message: 'Erro ao verificar status da carteira' },
      { status: 500 }
    );
  }
}
