/**
 * Handler: Wallet Statement PDF Generation
 *
 * Gera PDF do extrato da carteira.
 * Extrai lógica de app/api/wallet/statement/download/route.ts.
 */

import { prisma } from '../../../platform/db/db';
import { calculatePeriodSummary, getLastNDaysRange } from '../../../modules/wallet/application/period-summary';
import { generateStatementPdf } from '../../../shared/utils/statement-pdf';
import type { Prisma } from '@prisma/client';
import type { JobLogger } from '../../../platform/queue/helpers';

export async function generateStatementPdfFromData(params: {
  userId: string;
  walletId: string;
  dateFrom: string;
  dateTo: string;
  search?: string;
  log: JobLogger;
}): Promise<{ pdfBuffer: Buffer; fileName: string }> {
  const { userId, walletId, dateFrom, dateTo, search, log } = params;

  // 1. Buscar user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // 2. Verificar wallet
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    throw new Error('Carteira não encontrada');
  }

  // A carteira tem de ser de quem pediu o extrato
  if (wallet.userId !== userId) {
    throw new Error('Carteira não pertence ao usuário');
  }

  // 3. Definir período
  let periodStart: Date;
  let periodEnd: Date;

  if (dateFrom && dateTo) {
    periodStart = new Date(dateFrom);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(dateTo);
    periodEnd.setHours(23, 59, 59, 999);
  } else {
    const range = getLastNDaysRange(30);
    periodStart = range.start;
    periodEnd = range.end;
  }

  // 4. Buscar transações
  const whereClause: Prisma.WalletTransactionWhereInput = {
    walletId: wallet.id,
    status: 'CONFIRMED',
    confirmedAt: {
      gte: periodStart,
      lte: periodEnd,
    },
  };

  if (search && search.trim()) {
    whereClause.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { referenceId: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const transactions = await prisma.walletTransaction.findMany({
    where: whereClause,
    orderBy: { confirmedAt: 'desc' },
  });

  // 5. Calcular resumo
  const summary = calculatePeriodSummary(transactions, periodStart, periodEnd);

  log.info({ userId, walletId, transactionCount: transactions.length }, 'Generating statement PDF');

  // 6. Gerar PDF
  const pdfBuffer = await generateStatementPdf({
    user,
    periodStart,
    periodEnd,
    transactions,
    summary,
  });

  const fileName = `extrato-carteira-${periodStart.toISOString().split('T')[0]}-${periodEnd.toISOString().split('T')[0]}.pdf`;
  return { pdfBuffer, fileName };
}

