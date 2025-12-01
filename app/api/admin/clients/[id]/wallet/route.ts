/**
 * GET /api/admin/clients/[id]/wallet
 *
 * Retorna informações detalhadas da carteira de um usuário (Admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { getTransactionDirection } from '@/lib/wallet/transaction-direction';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id: userId } = await context.params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

    // Filtro de data (padrão: últimos 30 dias)
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const now = new Date();
    const defaultStartDate = new Date(now);
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    defaultStartDate.setHours(0, 0, 0, 0);

    const startDate = startDateParam ? new Date(startDateParam) : defaultStartDate;
    const endDate = endDateParam ? new Date(endDateParam) : new Date(now.setHours(23, 59, 59, 999));

    // Buscar carteira
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return NextResponse.json({
        wallet: null,
        transactions: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        periodStats: {
          credits: 0,
          debits: 0,
          creditsReais: 0,
          debitsReais: 0,
        },
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    }

    // Buscar transações com paginação e filtro de data
    const transactionWhere = {
      walletId: wallet.id,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: transactionWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.walletTransaction.count({
        where: transactionWhere,
      }),
    ]);

    // Calcular estatísticas do período selecionado usando agregações por tipo
    const periodWhereBase = {
      walletId: wallet.id,
      status: 'CONFIRMED' as const,
      createdAt: {
        gte: startDate,
        lte: endDate,
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
    });

    const periodCredits = creditsAgg._sum.amountCents || 0;
    const periodDebits = Math.abs(debitsAgg._sum.amountCents || 0);

    // Formatar transações
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amountCents: tx.amountCents,
      amountReais: Math.abs(tx.amountCents) / 100,
      direction: getTransactionDirection(tx.type, tx.amountCents),
      title: tx.title,
      referenceId: tx.referenceId,
      meta: tx.meta,
      createdAt: tx.createdAt,
      confirmedAt: tx.confirmedAt,
    }));

    return NextResponse.json({
      wallet: {
        id: wallet.id,
        availableCents: wallet.availableCents,
        pendingCents: wallet.pendingCents,
        availableReais: wallet.availableCents / 100,
        pendingReais: wallet.pendingCents / 100,
        hasNegativeBalance: wallet.availableCents < 0,
        negativeAmountCents: wallet.availableCents < 0 ? Math.abs(wallet.availableCents) : 0,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
      periodStats: {
        credits: periodCredits,
        debits: periodDebits,
        creditsReais: periodCredits / 100,
        debitsReais: periodDebits / 100,
      },
      transactions: formattedTransactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  } catch (error) {
    console.error('[ADMIN_GET_WALLET]', error);
    return NextResponse.json({ message: 'Erro ao buscar carteira' }, { status: 500 });
  }
}
