/**
 * GET /api/admin/finance/wallet-transactions
 *
 * Lista todas as transações de carteira de todos os clientes (visão admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission, WalletTxType } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { Paged } from '@/lib/admin/finance/types';
import {
  getTransactionDirection,
  getTransactionTypeLabel,
  formatTransactionAmount,
} from '@/lib/wallet/transaction-direction';


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

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') as WalletTxType | null;
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Count total
    const total = await prisma.walletTransaction.count({ where });

    // Fetch transactions with user info
    const transactions = await prisma.walletTransaction.findMany({
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
    });

    // Map to DTO
    const items: AdminWalletTransaction[] = transactions.map((tx) => {
      const direction = getTransactionDirection(tx.type, tx.amountCents);
      const typeLabel = getTransactionTypeLabel(tx.type);

      // Extract MercadoPago ID from meta field (Prisma returns JsonValue)
      const meta = tx.meta as Record<string, unknown> | null;
      const mercadoPagoId = (meta && typeof meta === 'object' && 'externalId' in meta)
        ? String(meta.externalId)
        : null;

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

    // Calculate period summary
    const summaryWhere = { ...where };
    delete summaryWhere.OR; // Remove search filter from summary

    const creditsAgg = await prisma.walletTransaction.aggregate({
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
    });

    const debitsAgg = await prisma.walletTransaction.aggregate({
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
    });

    const totalCreditsCents = creditsAgg._sum.amountCents || 0;
    const totalDebitsCents = Math.abs(debitsAgg._sum.amountCents || 0);

    const summary = {
      totalCredits: totalCreditsCents / 100,
      totalDebits: totalDebitsCents / 100,
      netAmount: (totalCreditsCents - totalDebitsCents) / 100,
      transactionCount: creditsAgg._count + debitsAgg._count,
    };

    const response: Paged<AdminWalletTransaction> & { summary: typeof summary } = {
      items,
      page,
      pageSize,
      total,
      summary,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ADMIN_WALLET_TRANSACTIONS] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar transações' },
      { status: 500 }
    );
  }
}
