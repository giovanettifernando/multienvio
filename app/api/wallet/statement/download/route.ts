/**
 * GET /api/wallet/statement/download
 *
 * Gera e retorna PDF binário do extrato da carteira
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
import { formatNumberBR } from '@/lib/format';
import puppeteer from 'puppeteer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 segundos para gerar o PDF

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

    // Processar query params para filtros
    const { searchParams } = new URL(request.url);
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
    const whereClause: any = {
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
        { type: { contains: searchQuery.trim(), mode: 'insensitive' } },
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

    // Gerar linhas da tabela
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
            <td>${date}</td>
            <td>${typeLabel}</td>
            <td style="color: ${color}; font-weight: 600; text-align: right;">${formattedAmount}</td>
            <td>${tx.title || typeLabel}</td>
          </tr>
        `;
      })
      .join('');

    const generatedAt = new Date();
    const periodLabel = `${periodStart.toLocaleDateString('pt-BR')} - ${periodEnd.toLocaleDateString('pt-BR')}`;

    // Gerar HTML
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extrato da Carteira - ${periodLabel}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #262626;
      background: #fff;
      padding: 40px;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #1890ff;
      padding-bottom: 20px;
    }

    .header h1 {
      font-size: 32px;
      color: #1890ff;
      margin-bottom: 8px;
    }

    .header p {
      font-size: 14px;
      color: #8c8c8c;
    }

    .info {
      margin-bottom: 30px;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .info-row:last-child {
      margin-bottom: 0;
    }

    .info-label {
      font-weight: 600;
      color: #595959;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    thead {
      background: #fafafa;
    }

    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #595959;
      border-bottom: 2px solid #d9d9d9;
      font-size: 14px;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 14px;
    }

    tr:hover {
      background: #fafafa;
    }

    .summary {
      padding: 20px;
      background: #f5f5f5;
      border-radius: 4px;
      margin-bottom: 30px;
    }

    .summary h3 {
      font-size: 18px;
      margin-bottom: 16px;
      color: #262626;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 14px;
    }

    .summary-row.total {
      font-weight: 600;
      font-size: 16px;
      padding-top: 12px;
      border-top: 2px solid #d9d9d9;
      margin-top: 12px;
    }

    .credit {
      color: #52c41a;
      font-weight: 600;
    }

    .debit {
      color: #ff4d4f;
      font-weight: 600;
    }

    .footer {
      text-align: center;
      color: #8c8c8c;
      font-size: 12px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #d9d9d9;
    }

    .footer p {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Envio Legal</h1>
    <p>Extrato da Carteira</p>
  </div>

  <div class="info">
    <div class="info-row">
      <span class="info-label">Usuário:</span>
      <span>${user.name || user.email}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Email:</span>
      <span>${user.email}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Período:</span>
      <span>${periodLabel}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Gerado em:</span>
      <span>${generatedAt.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}</span>
    </div>
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

    // Gerar PDF usando Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    await browser.close();

    // Nome do arquivo
    const fileName = `extrato-carteira-${periodStart.toISOString().split('T')[0]}-${periodEnd.toISOString().split('T')[0]}.pdf`;

    // Retornar PDF binário
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return NextResponse.json(
      { message: 'Erro ao gerar PDF', error: String(error) },
      { status: 500 }
    );
  }
}
