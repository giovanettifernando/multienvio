/**
 * Shared utility: Statement PDF generation
 *
 * Gera o PDF do extrato da carteira usando pdf-lib (JavaScript puro, sem dependência de navegador/Chromium)
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { formatNumberBR, formatWalletDescription } from '@/shared/utils/format';
import {
  getTransactionDirection,
  getTransactionTypeLabel,
} from '@/modules/wallet/application/transaction-direction';
import type { WalletTxType } from '@prisma/client';

export interface StatementPdfParams {
  user: { name: string | null; email: string };
  periodStart: Date;
  periodEnd: Date;
  transactions: Array<{
    type: WalletTxType;
    amountCents: number;
    title: string | null;
    confirmedAt: Date | null;
    createdAt: Date;
  }>;
  summary: {
    totalCredits: number;
    totalDebits: number;
    netAmount: number;
    transactionCount: number;
  };
}

/**
 * Gera o PDF do extrato usando pdf-lib (JavaScript puro)
 */
export async function generateStatementPdf(params: StatementPdfParams): Promise<Buffer> {
  const { user, periodStart, periodEnd, transactions, summary } = params;

  // Criar documento PDF
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Cores
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.6, 0.6, 0.6);
  const green = rgb(0.32, 0.77, 0.1); // #52c41a
  const red = rgb(1, 0.3, 0.31); // #ff4d4f
  const blue = rgb(0.09, 0.56, 1); // #1890ff

  // Configurações da página
  const pageWidth = 595; // A4
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  // Criar primeira página
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;

  // Função auxiliar para adicionar nova página se necessário
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition - requiredSpace < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
      return true;
    }
    return false;
  };

  // === HEADER ===
  // Logo Envio Legal
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    const logoPath = join(process.cwd(), 'public', 'images', 'envio-legal-logo.png');
    const logoBuffer = await readFile(logoPath);
    logoImage = await pdfDoc.embedPng(logoBuffer);
  } catch {
    // Logo optional - continue without it
  }

  // Logo maior com proporção 2000x800 = 2.5:1
  const logoHeight = 50;
  const logoWidth = logoHeight * 2.5; // 125pt

  if (logoImage) {
    page.drawImage(logoImage, {
      x: margin,
      y: yPosition - logoHeight + 15,
      width: logoWidth,
      height: logoHeight,
    });
  } else {
    // Fallback para texto se logo não carregar
    page.drawText('ENVIO LEGAL', {
      x: margin,
      y: yPosition - 10,
      size: 28,
      font: helveticaBold,
      color: blue,
    });
  }

  // Texto "Extrato da Carteira" ao lado do logo
  page.drawText('Extrato da Carteira', {
    x: margin + logoWidth + 20,
    y: yPosition - logoHeight / 2 - 5,
    size: 20,
    font: helveticaBold,
    color: gray,
  });
  yPosition -= logoHeight + 10;

  // Linha separadora
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: pageWidth - margin, y: yPosition },
    thickness: 2,
    color: blue,
  });
  yPosition -= 25;

  // === INFORMAÇÕES DO USUÁRIO ===
  const infoLineHeight = 18;

  page.drawText('Usuário:', {
    x: margin,
    y: yPosition,
    size: 10,
    font: helveticaBold,
    color: gray,
  });
  page.drawText(user.name || user.email, {
    x: margin + 100,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: black,
  });
  yPosition -= infoLineHeight;

  page.drawText('Email:', {
    x: margin,
    y: yPosition,
    size: 10,
    font: helveticaBold,
    color: gray,
  });
  page.drawText(user.email, {
    x: margin + 100,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: black,
  });
  yPosition -= infoLineHeight;

  const periodLabel = `${periodStart.toLocaleDateString('pt-BR')} - ${periodEnd.toLocaleDateString('pt-BR')}`;
  page.drawText('Período:', {
    x: margin,
    y: yPosition,
    size: 10,
    font: helveticaBold,
    color: gray,
  });
  page.drawText(periodLabel, {
    x: margin + 100,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: black,
  });
  yPosition -= infoLineHeight;

  const generatedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  page.drawText('Gerado em:', {
    x: margin,
    y: yPosition,
    size: 10,
    font: helveticaBold,
    color: gray,
  });
  page.drawText(generatedAt, {
    x: margin + 100,
    y: yPosition,
    size: 10,
    font: helvetica,
    color: black,
  });
  yPosition -= 30;

  // === TABELA DE TRANSAÇÕES ===
  // Cabeçalho da tabela
  const colWidths = {
    date: 100,
    type: 100,
    value: 100,
    description: contentWidth - 300,
  };

  page.drawRectangle({
    x: margin,
    y: yPosition - 15,
    width: contentWidth,
    height: 20,
    color: rgb(0.95, 0.95, 0.95),
  });

  page.drawText('Data', {
    x: margin + 5,
    y: yPosition - 10,
    size: 10,
    font: helveticaBold,
    color: gray,
  });
  page.drawText('Tipo', {
    x: margin + colWidths.date + 5,
    y: yPosition - 10,
    size: 10,
    font: helveticaBold,
    color: gray,
  });
  page.drawText('Valor', {
    x: margin + colWidths.date + colWidths.type + 5,
    y: yPosition - 10,
    size: 10,
    font: helveticaBold,
    color: gray,
  });
  page.drawText('Descrição', {
    x: margin + colWidths.date + colWidths.type + colWidths.value + 5,
    y: yPosition - 10,
    size: 10,
    font: helveticaBold,
    color: gray,
  });
  yPosition -= 25;

  // Linhas da tabela
  if (transactions.length === 0) {
    checkNewPage(30);
    page.drawText('Nenhuma transação encontrada no período', {
      x: margin + contentWidth / 2 - 100,
      y: yPosition - 10,
      size: 10,
      font: helvetica,
      color: lightGray,
    });
    yPosition -= 30;
  } else {
    for (const tx of transactions) {
      checkNewPage(25);

      const direction = getTransactionDirection(tx.type, tx.amountCents);
      const typeLabel = getTransactionTypeLabel(tx.type);
      const valueColor = direction === 'credit' ? green : red;
      const sign = direction === 'credit' ? '+' : '-';
      const formattedValue = `${sign} R$ ${formatNumberBR(Math.abs(tx.amountCents) / 100)}`;

      const date = new Date(tx.confirmedAt || tx.createdAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const description = formatWalletDescription(tx.title) || typeLabel;
      // Truncar descrição se muito longa
      const maxDescLength = 35;
      const truncatedDesc = description.length > maxDescLength
        ? description.substring(0, maxDescLength) + '...'
        : description;

      page.drawText(date, {
        x: margin + 5,
        y: yPosition - 10,
        size: 9,
        font: helvetica,
        color: black,
      });
      page.drawText(typeLabel, {
        x: margin + colWidths.date + 5,
        y: yPosition - 10,
        size: 9,
        font: helvetica,
        color: black,
      });
      page.drawText(formattedValue, {
        x: margin + colWidths.date + colWidths.type + 5,
        y: yPosition - 10,
        size: 9,
        font: helveticaBold,
        color: valueColor,
      });
      page.drawText(truncatedDesc, {
        x: margin + colWidths.date + colWidths.type + colWidths.value + 5,
        y: yPosition - 10,
        size: 9,
        font: helvetica,
        color: black,
      });

      // Linha separadora
      yPosition -= 20;
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: pageWidth - margin, y: yPosition },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
      yPosition -= 5;
    }
  }

  // === RESUMO ===
  checkNewPage(140);
  yPosition -= 20;

  // Box do resumo (altura 120 para caber todo conteúdo)
  page.drawRectangle({
    x: margin,
    y: yPosition - 105,
    width: contentWidth,
    height: 120,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  });

  page.drawText('Resumo do Período', {
    x: margin + 15,
    y: yPosition - 5,
    size: 14,
    font: helveticaBold,
    color: black,
  });
  yPosition -= 25;

  const creditText = `+ R$ ${formatNumberBR(summary.totalCredits)}`;
  const creditTextWidth = helveticaBold.widthOfTextAtSize(creditText, 10);

  page.drawText('Total de créditos:', {
    x: margin + 15,
    y: yPosition - 5,
    size: 10,
    font: helvetica,
    color: gray,
  });
  page.drawText(creditText, {
    x: margin + contentWidth - 15 - creditTextWidth,
    y: yPosition - 5,
    size: 10,
    font: helveticaBold,
    color: green,
  });
  yPosition -= 18;

  const debitText = `- R$ ${formatNumberBR(summary.totalDebits)}`;
  const debitTextWidth = helveticaBold.widthOfTextAtSize(debitText, 10);

  page.drawText('Total de débitos:', {
    x: margin + 15,
    y: yPosition - 5,
    size: 10,
    font: helvetica,
    color: gray,
  });
  page.drawText(debitText, {
    x: margin + contentWidth - 15 - debitTextWidth,
    y: yPosition - 5,
    size: 10,
    font: helveticaBold,
    color: red,
  });
  yPosition -= 22;

  // Linha separadora
  page.drawLine({
    start: { x: margin + 15, y: yPosition },
    end: { x: pageWidth - margin - 15, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  yPosition -= 15;

  const saldoColor = summary.netAmount >= 0 ? green : red;
  const saldoSign = summary.netAmount >= 0 ? '+' : '-';
  const saldoText = `${saldoSign} R$ ${formatNumberBR(Math.abs(summary.netAmount))}`;
  const saldoTextWidth = helveticaBold.widthOfTextAtSize(saldoText, 11);

  page.drawText('Saldo do período:', {
    x: margin + 15,
    y: yPosition - 5,
    size: 11,
    font: helveticaBold,
    color: black,
  });
  page.drawText(saldoText, {
    x: margin + contentWidth - 15 - saldoTextWidth,
    y: yPosition - 5,
    size: 11,
    font: helveticaBold,
    color: saldoColor,
  });
  yPosition -= 20;

  page.drawText(`Total de transações: ${summary.transactionCount}`, {
    x: margin + 15,
    y: yPosition - 5,
    size: 9,
    font: helvetica,
    color: lightGray,
  });

  // === FOOTER ===
  checkNewPage(60);
  yPosition = margin + 30;

  page.drawLine({
    start: { x: margin, y: yPosition + 20 },
    end: { x: pageWidth - margin, y: yPosition + 20 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  page.drawText('Este documento foi gerado automaticamente pelo sistema Envio Legal.', {
    x: margin,
    y: yPosition,
    size: 8,
    font: helvetica,
    color: lightGray,
  });
  page.drawText('Para dúvidas ou mais informações, entre em contato com nosso suporte.', {
    x: margin,
    y: yPosition - 12,
    size: 8,
    font: helvetica,
    color: lightGray,
  });

  // Salvar e retornar
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
