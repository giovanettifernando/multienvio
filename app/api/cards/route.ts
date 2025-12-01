/**
 * GET /api/cards
 * Alias para /api/account/cards - retorna cartões salvos do usuário
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { listUserCards } from '@/lib/services/account-cards.service';

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const result = await listUserCards(
      session.userId,
      { page: 1, pageSize: 100 },
      {}
    );

    // Mapear para o formato esperado pelo modal de checkout
    const cards = result.items.map((card) => ({
      id: card.id,
      brand: card.brand.toLowerCase(), // visa, mastercard, amex, elo, hipercard
      last4: card.last4,
      holder: card.holderName,
      expMonth: card.expMonth,
      expYear: card.expYear,
    }));

    return NextResponse.json(cards);
  } catch (error) {
    console.error('[CARDS_GET]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar cartões' },
      { status: 500 }
    );
  }
}
