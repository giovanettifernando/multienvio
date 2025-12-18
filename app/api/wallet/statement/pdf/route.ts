/**
 * GET /api/wallet/statement/pdf
 *
 * Gera PDF do extrato da carteira com filtros de período
 */

import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { getSession } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';
import { calculatePeriodSummary, getLastNDaysRange, formatPeriodLabel } from '@/modules/wallet/application/period-summary';
import {
  getTransactionDirection,
  getTransactionTypeLabel,
  formatTransactionAmount,
} from '@/modules/wallet/application/transaction-direction';
import { formatNumberBR, formatWalletDescription } from '@/shared/utils/format';
import type { Prisma, WalletTxType } from '@prisma/client';

export const GET = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  try {
    // Verificar autenticação
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Buscar usuário para obter nome/email
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Usuário não encontrado' },
        { status: 404 }
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
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    // Definir intervalo de datas (padrão: últimos 30 dias)
    let periodStart: Date;
    let periodEnd: Date;

    if (dateFrom && dateTo) {
      periodStart = new Date(dateFrom);
      periodEnd = new Date(dateTo);
      periodEnd.setHours(23, 59, 59, 999);
    } else {
      const range = getLastNDaysRange(30);
      periodStart = range.start;
      periodEnd = range.end;
    }

    // Construir filtro WHERE
    const whereClause: Prisma.WalletTransactionWhereInput = {
      walletId: wallet.id,
      status: 'CONFIRMED',
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

    // Buscar transações
    const transactions = await prisma.walletTransaction.findMany({
      where: whereClause,
      orderBy: { confirmedAt: 'desc' },
    });

    // Calcular resumo do período
    const summary = calculatePeriodSummary(transactions, periodStart, periodEnd);

    // Formatar período para título
    const periodLabel = formatPeriodLabel(summary.periodStart, summary.periodEnd);

    logger.info('wallet_statement_pdf_generated', {
      userId: session.userId,
      transactionCount: transactions.length,
    });

    // Gerar HTML para PDF
    const html = generateStatementHTML({
      user,
      transactions,
      summary,
      periodLabel,
      generatedAt: new Date(),
    });

    // Retornar HTML como resposta (o navegador pode usar window.print())
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="extrato-${periodStart.toISOString().split('T')[0]}-${periodEnd.toISOString().split('T')[0]}.html"`,
      },
    });
  } catch (error) {
    logger.error('wallet_statement_pdf_error', { err: error });
    return NextResponse.json(
      { message: 'Erro ao gerar PDF do extrato' },
      { status: 500 }
    );
  }
});

/**
 * Gerar HTML formatado para impressão/PDF
 */
function generateStatementHTML(params: {
  user: { id: string; name: string | null; email: string };
  transactions: Array<{
    title: string | null;
    type: WalletTxType;
    amountCents: number;
    confirmedAt: Date | null;
    createdAt: Date;
  }>;
  summary: {
    totalCredits: number;
    totalDebits: number;
    netAmount: number;
    transactionCount: number;
  };
  periodLabel: string;
  generatedAt: Date;
}): string {
  const { user, transactions, summary, periodLabel, generatedAt } = params;

  const transactionRows = transactions
    .map((tx) => {
      const direction = getTransactionDirection(tx.type, tx.amountCents);
      const typeLabel = getTransactionTypeLabel(tx.type);
      const formattedAmount = formatTransactionAmount(tx.amountCents, direction);
      const date = new Date(tx.confirmedAt || tx.createdAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const color = direction === 'credit' ? '#52c41a' : '#ff4d4f';

      return `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0;">${date}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0;">${typeLabel}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; color: ${color}; font-weight: 600;">
            ${formattedAmount}
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0;">${formatWalletDescription(tx.title) || typeLabel}</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extrato da Carteira - ${periodLabel}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #262626;
      line-height: 1.6;
      padding: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1890ff;
    }

    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #1890ff;
    }

    .title {
      text-align: right;
    }

    .title h1 {
      font-size: 18px;
      font-weight: 600;
      color: #262626;
      margin-bottom: 4px;
    }

    .title p {
      font-size: 14px;
      color: #8c8c8c;
    }

    .user-info {
      margin-bottom: 20px;
      padding: 12px;
      background-color: #fafafa;
      border-radius: 4px;
    }

    .user-info p {
      font-size: 13px;
      color: #595959;
      margin: 4px 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    thead {
      background-color: #fafafa;
    }

    thead th {
      padding: 12px 8px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: #595959;
      border-bottom: 2px solid #d9d9d9;
    }

    thead th:nth-child(3) {
      text-align: right;
    }

    tbody td {
      font-size: 13px;
    }

    .summary {
      margin-top: 30px;
      padding: 20px;
      background-color: #fafafa;
      border-radius: 4px;
      border-left: 4px solid #1890ff;
    }

    .summary h3 {
      font-size: 14px;
      font-weight: 600;
      color: #262626;
      margin-bottom: 12px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 13px;
    }

    .summary-row.total {
      border-top: 2px solid #d9d9d9;
      margin-top: 8px;
      padding-top: 12px;
      font-weight: 600;
      font-size: 14px;
    }

    .credit {
      color: #52c41a;
    }

    .debit {
      color: #ff4d4f;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #d9d9d9;
      font-size: 12px;
      color: #8c8c8c;
      text-align: center;
    }

    @media print {
      body {
        padding: 0;
      }

      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Envio Legal</div>
    <div class="title">
      <h1>Extrato da Carteira</h1>
      <p>Período: ${periodLabel}</p>
    </div>
  </div>

  <div class="user-info">
    <p><strong>Cliente:</strong> ${user.name || user.email}</p>
    <p><strong>ID:</strong> ${user.id}</p>
    <p><strong>Gerado em:</strong> ${generatedAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Tipo</th>
        <th style="text-align: right;">Valor</th>
        <th>Descrição</th>
      </tr>
    </thead>
    <tbody>
      ${transactionRows || '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #8c8c8c;">Nenhuma transação encontrada no período</td></tr>'}
    </tbody>
  </table>

  <div class="summary">
    <h3>Resumo do Período</h3>
    <div class="summary-row">
      <span>Total de créditos:</span>
      <span class="credit">+ R$ ${formatNumberBR(summary.totalCredits)}</span>
    </div>
    <div class="summary-row">
      <span>Total de débitos:</span>
      <span class="debit">- R$ ${formatNumberBR(summary.totalDebits)}</span>
    </div>
    <div class="summary-row total">
      <span>Saldo do período:</span>
      <span style="color: ${summary.netAmount >= 0 ? '#52c41a' : '#ff4d4f'};">
        ${summary.netAmount >= 0 ? '+' : ''} R$ ${formatNumberBR(Math.abs(summary.netAmount))}
      </span>
    </div>
    <div class="summary-row" style="border-top: 1px solid #d9d9d9; margin-top: 8px; padding-top: 8px;">
      <span>Total de transações:</span>
      <span>${summary.transactionCount}</span>
    </div>
  </div>

  <div class="footer">
    <p>Este documento foi gerado automaticamente pelo sistema Envio Legal.</p>
    <p>Para dúvidas ou mais informações, entre em contato com nosso suporte.</p>
  </div>
</body>
</html>
  `.trim();
}
