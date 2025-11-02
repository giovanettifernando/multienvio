/**
 * GET /api/wallet/transactions
 *
 * Lista as transações da carteira do usuário autenticado
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { listTransactions } from '@/lib/wallet/wallet.service';
import { ListTransactionsSchema } from '@/lib/validation/wallet';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Verificar autenticação
    const session = await getSession();

    if (!session) {
      console.log('[WALLET_TRANSACTIONS] No session found');
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    console.log('[WALLET_TRANSACTIONS] Request from user:', session.userId);

    // Parsear query params
    const { searchParams } = new URL(request.url);
    const rawParams = {
      limit: searchParams.get('limit'),
      cursor: searchParams.get('cursor'),
    };

    // Validar params
    const params = ListTransactionsSchema.parse(rawParams);
    console.log('[WALLET_TRANSACTIONS] Params:', params);

    // Buscar transações (converter null para undefined se necessário)
    const transactions = await listTransactions(session.userId, {
      limit: params.limit,
      cursor: params.cursor ?? undefined,
    });
    console.log('[WALLET_TRANSACTIONS] Found transactions:', transactions.length);

    return NextResponse.json({
      transactions,
      hasMore: transactions.length === params.limit,
      cursor: transactions.length > 0 ? transactions[transactions.length - 1].id : null,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: 'Parâmetros inválidos',
          errors: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 422 }
      );
    }

    console.error('[WALLET_TRANSACTIONS] Error fetching transactions:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar transações' },
      { status: 500 }
    );
  }
}
