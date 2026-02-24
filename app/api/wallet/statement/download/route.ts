/**
 * GET /api/wallet/statement/download
 *
 * Gera e retorna PDF binário do extrato da carteira
 * Usa pdf-lib (JavaScript puro, sem dependência de navegador/Chromium)
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';
import { calculatePeriodSummary, getLastNDaysRange } from '@/modules/wallet/application/period-summary';
import { generateStatementPdf } from '@/shared/utils/statement-pdf';
import type { Prisma } from '@prisma/client';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';

export const maxDuration = 60; // 60 segundos para gerar o PDF

export const GET = withApiHandlerResponse(async ({ req, logger }) => {
  // Verificar autenticação
  const session = await getSession();

  if (!session) {
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Não autenticado', status: 401 });
  }

  // Buscar usuário para obter nome/email
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Usuário não encontrado', status: 404 });
  }

  // Buscar carteira do usuário
  const wallet = await prisma.wallet.findUnique({
    where: { userId: session.userId },
  });

  if (!wallet) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Carteira não encontrada', status: 404 });
  }

  // Processar query params para filtros
  const { searchParams } = new URL(req.url);
  const dateFromStr = searchParams.get('dateFrom');
  const dateToStr = searchParams.get('dateTo');
  const searchQuery = searchParams.get('search');

  // Definir período
  let periodStart: Date;
  let periodEnd: Date;

  if (dateFromStr && dateToStr) {
    periodStart = new Date(dateFromStr);
    periodStart.setHours(0, 0, 0, 0);

    periodEnd = new Date(dateToStr);
    periodEnd.setHours(23, 59, 59, 999);
  } else {
    // Padrão: últimos 30 dias
    const range = getLastNDaysRange(30);
    periodStart = range.start;
    periodEnd = range.end;
  }

  // Construir filtro de busca
  const whereClause: Prisma.WalletTransactionWhereInput = {
    walletId: wallet.id,
    status: 'CONFIRMED',
    confirmedAt: {
      gte: periodStart,
      lte: periodEnd,
    },
  };

  if (searchQuery && searchQuery.trim()) {
    whereClause.OR = [
      { title: { contains: searchQuery.trim(), mode: 'insensitive' } },
      { referenceId: { contains: searchQuery.trim(), mode: 'insensitive' } },
    ];
  }

  // Buscar transações
  const transactions = await prisma.walletTransaction.findMany({
    where: whereClause,
    orderBy: { confirmedAt: 'desc' },
  });

  // Calcular resumo do período
  const summary = calculatePeriodSummary(transactions, periodStart, periodEnd);

  // Gerar PDF usando pdf-lib
  const pdfBuffer = await generateStatementPdf({
    user,
    periodStart,
    periodEnd,
    transactions,
    summary,
  });

  // Nome do arquivo
  const fileName = `extrato-carteira-${periodStart.toISOString().split('T')[0]}-${periodEnd.toISOString().split('T')[0]}.pdf`;

  logger.info('wallet_statement_pdf_generated', { userId: session.userId, fileName });

  // Retornar PDF binário
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  });
});

