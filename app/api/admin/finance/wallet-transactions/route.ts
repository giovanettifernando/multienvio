/**
 * GET /api/admin/finance/wallet-transactions
 *
 * Lista todas as transações de carteira de todos os clientes (visão admin)
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission, WalletTxType } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import type { Paged } from '@/modules/admin/application/finance/types';
import {
  getTransactionDirection,
  getTransactionTypeLabel,
  formatTransactionAmount,
} from '@/modules/wallet/application/transaction-direction';


export interface AdminWalletTransaction {
  id: string;
  createdAt: string;
  confirmedAt: string | null;
  customerId: string;
  customerName: string;
  type: WalletTxType;
  typeLabel: string;
  direction: 'credit' | 'debit';
  amountCents: number;
  amountReais: number;
  formattedAmount: string;
  title: string | null;
  referenceId: string | null;
  status: string;
  mercadoPagoId: string | null;
}

type WalletTransactionsResponse = Paged<AdminWalletTransaction> & {
  summary: {
    totalCredits: number;
    totalDebits: number;
    netAmount: number;
    transactionCount: number;
  };
};

export const GET = withApiHandler<WalletTransactionsResponse>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const q = searchParams.get('q') || '';
  const type = searchParams.get('type') as WalletTxType | null;
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');

  // Build where clause
  const where: any = {
    status: 'CONFIRMED', // Only show confirmed transactions
  };

  // Date filter
  if (dateStart || dateEnd) {
    where.confirmedAt = {};
    if (dateStart) {
      where.confirmedAt.gte = new Date(dateStart);
    }
    if (dateEnd) {
      where.confirmedAt.lte = new Date(dateEnd);
    }
  }

  // Type filter
  if (type) {
    where.type = type;
  }

  // Search filter (search in user name/email or transaction title/referenceId)
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { referenceId: { contains: q, mode: 'insensitive' } },
      { wallet: { user: { name: { contains: q, mode: 'insensitive' } } } },
      { wallet: { user: { email: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  // Buscar total e transações em paralelo para melhor performance
  const [total, transactions] = await Promise.all([
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.findMany({
      where,
      include: {
        wallet: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { confirmedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Map to DTO
  const items: AdminWalletTransaction[] = transactions.map((tx) => {
    const direction = getTransactionDirection(tx.type, tx.amountCents);
    const typeLabel = getTransactionTypeLabel(tx.type);

    // Extract Pagar.me payment ID from meta field (Prisma returns JsonValue)
    const meta = tx.meta as Record<string, unknown> | null;
    const mercadoPagoId =
      meta && typeof meta === 'object' && 'externalId' in meta ? String(meta.externalId) : null;

    return {
      id: tx.id,
      createdAt: tx.createdAt.toISOString(),
      confirmedAt: tx.confirmedAt?.toISOString() || null,
      customerId: tx.wallet.user.id,
      customerName: tx.wallet.user.name || tx.wallet.user.email,
      type: tx.type,
      typeLabel,
      direction,
      amountCents: tx.amountCents,
      amountReais: Math.abs(tx.amountCents) / 100,
      formattedAmount: formatTransactionAmount(tx.amountCents, direction),
      title: tx.title,
      referenceId: tx.referenceId,
      status: tx.status,
      mercadoPagoId,
    };
  });

  // Calculate period summary (respeitando os filtros de data e tipo aplicados)
  const summaryWhere = { ...where };
  delete summaryWhere.OR; // Remove search filter from summary (summary é do período, não da pesquisa)

  // Se um tipo específico foi filtrado, o summary reflete apenas esse tipo
  // Se não, calcula créditos e débitos separadamente
  let totalCreditsCents = 0;
  let totalDebitsCents = 0;
  let transactionCount = 0;

  if (type) {
    // Tipo específico filtrado - calcula apenas esse tipo
    const agg = await prisma.walletTransaction.aggregate({
      where: summaryWhere,
      _sum: { amountCents: true },
      _count: true,
    });
    const amount = agg._sum.amountCents || 0;
    transactionCount = agg._count;
    if (amount >= 0) {
      totalCreditsCents = amount;
    } else {
      totalDebitsCents = Math.abs(amount);
    }
  } else {
    // Sem filtro de tipo - calcula créditos e débitos separadamente
    const [creditsAgg, debitsAgg] = await Promise.all([
      prisma.walletTransaction.aggregate({
        where: {
          ...summaryWhere,
          OR: [
            { type: 'TOPUP' },
            { type: 'REFUND' },
            { type: 'ADJUSTMENT', amountCents: { gte: 0 } },
          ],
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.walletTransaction.aggregate({
        where: {
          ...summaryWhere,
          OR: [
            { type: 'PURCHASE' },
            { type: 'WITHDRAW' },
            { type: 'ADJUSTMENT', amountCents: { lt: 0 } },
          ],
        },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]);

    totalCreditsCents = creditsAgg._sum.amountCents || 0;
    totalDebitsCents = Math.abs(debitsAgg._sum.amountCents || 0);
    transactionCount = creditsAgg._count + debitsAgg._count;
  }

  const summary = {
    totalCredits: totalCreditsCents / 100,
    totalDebits: totalDebitsCents / 100,
    netAmount: (totalCreditsCents - totalDebitsCents) / 100,
    transactionCount,
  };

  const response: Paged<AdminWalletTransaction> & { summary: typeof summary } = {
    items,
    page,
    pageSize,
    total,
    summary,
  };

  return { data: response };
});
