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
import type { Prisma } from '@prisma/client';

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
      // Criar datas em UTC para evitar problemas de timezone
      periodStart = new Date(dateFrom + 'T00:00:00.000Z');
      periodEnd = new Date(dateTo + 'T23:59:59.999Z'); // Incluir todo o dia final em UTC
    } else {
      const range = getLastNDaysRange(30);
      periodStart = range.start;
      periodEnd = range.end;
    }

    // Construir filtro WHERE
    const whereClause: Prisma.WalletTransactionWhereInput = {
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

    // Calcular resumo do período usando agregações do Prisma (otimizado)
    const periodWhereBase = {
      walletId: wallet.id,
      status: 'CONFIRMED' as const,
      confirmedAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    };

    // Agregar créditos: TOPUP, REFUND, ADJUSTMENT positivo
    const creditsAgg = await prisma.walletTransaction.aggregate({
      where: {
        ...periodWhereBase,
        OR: [
          { type: 'TOPUP' },
          { type: 'REFUND' },
          { type: 'ADJUSTMENT', amountCents: { gte: 0 } },
        ],
      },
      _sum: { amountCents: true },
      _count: true,
    });

    // Agregar débitos: PURCHASE, WITHDRAW, ADJUSTMENT negativo
    const debitsAgg = await prisma.walletTransaction.aggregate({
      where: {
        ...periodWhereBase,
        OR: [
          { type: 'PURCHASE' },
          { type: 'WITHDRAW' },
          { type: 'ADJUSTMENT', amountCents: { lt: 0 } },
        ],
      },
      _sum: { amountCents: true },
      _count: true,
    });

    // Calcular totais
    const totalCreditsCents = creditsAgg._sum.amountCents || 0;
    const totalDebitsCents = Math.abs(debitsAgg._sum.amountCents || 0);
    const transactionCount = creditsAgg._count + debitsAgg._count;

    const summary = {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalCredits: totalCreditsCents / 100,
      totalDebits: totalDebitsCents / 100,
      netAmount: (totalCreditsCents - totalDebitsCents) / 100,
      transactionCount,
    };

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
