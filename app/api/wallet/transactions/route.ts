/**
 * GET /api/wallet/transactions
 *
 * Lista as transações da carteira com filtros de data e busca + resumo do período
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { calculatePeriodSummary, getLastNDaysRange } from '@/lib/wallet/period-summary';
import {
  getTransactionDirection,
  getTransactionTypeLabel,
  formatTransactionAmount,
} from '@/lib/wallet/transaction-direction';
import { formatWalletDescription } from '@/lib/format';
import type { StatementResponse } from '@/types/wallet-statement';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Verificar autenticação
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Buscar carteira do usuário
    const wallet = await prisma.wallet.findUnique({
      where: { userId: session.userId },
    });

    if (!wallet) {
      return NextResponse.json(
        { message: 'Carteira não encontrada' },
        { status: 404 }
      );
    }

    // Parsear query params
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Definir intervalo de datas (padrão: últimos 30 dias)
    let periodStart: Date;
    let periodEnd: Date;

    if (dateFrom && dateTo) {
      periodStart = new Date(dateFrom);
      periodEnd = new Date(dateTo);
      periodEnd.setHours(23, 59, 59, 999); // Incluir todo o dia final
    } else {
      const range = getLastNDaysRange(30);
      periodStart = range.start;
      periodEnd = range.end;
    }

    // Construir filtro WHERE
    const whereClause: any = {
      walletId: wallet.id,
      status: 'CONFIRMED', // Apenas transações confirmadas
      confirmedAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    };

    // Adicionar busca por texto (se fornecida)
    if (search && search.trim()) {
      whereClause.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { type: { contains: search.trim(), mode: 'insensitive' } },
        { referenceId: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Buscar total de transações (para paginação)
    const total = await prisma.walletTransaction.count({ where: whereClause });

    // Buscar transações paginadas
    const transactions = await prisma.walletTransaction.findMany({
      where: whereClause,
      orderBy: { confirmedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Buscar TODAS as transações do período para calcular resumo (sem paginação)
    const allPeriodTransactions = await prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        status: 'CONFIRMED',
        confirmedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // Calcular resumo do período
    const summary = calculatePeriodSummary(allPeriodTransactions, periodStart, periodEnd);

    // Formatar transações para DTO
    const transactionsDTO = transactions.map((tx) => {
      const direction = getTransactionDirection(tx.type, tx.amountCents);
      const typeLabel = getTransactionTypeLabel(tx.type);

      return {
        id: tx.id,
        type: tx.type,
        typeLabel,
        status: tx.status,
        amountCents: tx.amountCents,
        amountReais: tx.amountCents / 100,
        direction,
        formattedAmount: formatTransactionAmount(tx.amountCents, direction),
        title: tx.title,
        description: formatWalletDescription(tx.title) || typeLabel,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt.toISOString(),
        confirmedAt: tx.confirmedAt?.toISOString() || null,
      };
    });

    const response: StatementResponse = {
      transactions: transactionsDTO,
      summary,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[WALLET_TRANSACTIONS] Error fetching transactions:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar transações' },
      { status: 500 }
    );
  }
}
