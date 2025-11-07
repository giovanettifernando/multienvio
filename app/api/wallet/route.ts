/**
 * GET /api/wallet
 *
 * Retorna o saldo da carteira do usuário autenticado
 */

import { NextResponse } from 'next/server';
import { getBalance } from '@/lib/wallet/wallet.service';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Verificar autenticação
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Buscar saldo
    const balance = await getBalance(session.userId);

    return NextResponse.json({
      balance: balance.availableReais,
      currency: 'BRL',
      available: balance.availableReais,
      pending: balance.pendingReais,
      availableCents: balance.availableCents,
      pendingCents: balance.pendingCents,
    });
  } catch (error) {
    console.error('[WALLET] Error fetching balance:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar saldo da carteira' },
      { status: 500 }
    );
  }
}
