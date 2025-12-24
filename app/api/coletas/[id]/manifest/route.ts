import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { requireUserSession } from '@/platform/auth/require-session';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { formatCEP, formatCNPJ } from '@/shared/utils/masks';

/**
 * GET /api/coletas/[id]/manifest
 * Gera PDF do manifesto de coleta com dados do pickup request
 */
export const GET = withApiHandlerResponse<{ id: string }>(async (context) => {
  const session = await requireUserSession(context.req);

  const { id } = context.params;

  // Buscar pickup request com dados completos
  const pickupRequest = await prisma.pickupRequest.findUnique({
    where: { id },
    include: {
      shipment: {
        select: {
          id: true,
          platformTrackingCode: true,
          carrierTrackingCode: true,
          carrier: true,
          service: true,
          originCep: true,
          destinationCep: true,
          recipientName: true,
          weight: true,
        },
      },
      user: {
        select: {
          name: true,
          email: true,
          razaoSocial: true,
          cnpj: true,
          hasCompany: true,
        },
      },
    },
  });

  if (!pickupRequest) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Coleta não encontrada',
      status: 404
    });
  }

  if (pickupRequest.userId !== session.userId) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Acesso negado',
      status: 403
    });
  }

  // Gerar PDF do manifesto
  const pdfBuffer = await generateManifestPdf(pickupRequest);

  const filename = `manifesto_coleta_${pickupRequest.id.slice(-8)}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  });
});

type PickupRequestWithRelations = {
  id: string;
  originCep: string;
  originAddress: string | null;
  originCity: string | null;
  originUf: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  scheduleAt: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  shipment: {
    id: string;
    platformTrackingCode: string;
    carrierTrackingCode: string | null;
    carrier: string | null;
    service: string | null;
    originCep: string;
    destinationCep: string;
    recipientName: string | null;
    weight: number;
  };
  user: {
    name: string | null;
    email: string;
    razaoSocial: string | null;
    cnpj: string | null;
    hasCompany: boolean;
  };
};

async function generateManifestPdf(pickup: PickupRequestWithRelations): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Página A4
  const pageWidth = 595;
  const pageHeight = 842;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const margin = 50;
  let yPos = pageHeight - margin;

  // Cores
  const primaryColor = rgb(0, 0.22, 0.45); // #003873
  const textColor = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.6, 0.6, 0.6);

  // Logo Envio Legal (se disponível)
  try {
    const logoPath = join(process.cwd(), 'public', 'images', 'envio-legal-logo.png');
    const logoBuffer = await readFile(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBuffer);
    const logoHeight = 40;
    const logoWidth = logoHeight * 2.5;
    page.drawImage(logoImage, {
      x: margin,
      y: yPos - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
    yPos -= logoHeight + 20;
  } catch {
    // Se não carregar logo, desenhar texto
    page.drawText('ENVIO LEGAL', {
      x: margin,
      y: yPos - 20,
      size: 24,
      font: helveticaBold,
      color: primaryColor,
    });
    yPos -= 40;
  }

  // Título
  page.drawText('MANIFESTO DE COLETA', {
    x: margin,
    y: yPos,
    size: 18,
    font: helveticaBold,
    color: primaryColor,
  });
  yPos -= 30;

  // Linha divisória
  page.drawLine({
    start: { x: margin, y: yPos },
    end: { x: pageWidth - margin, y: yPos },
    thickness: 1,
    color: primaryColor,
  });
  yPos -= 25;

  // Função auxiliar para desenhar campo
  const drawField = (label: string, value: string | null | undefined, bold = false) => {
    page.drawText(label, {
      x: margin,
      y: yPos,
      size: 10,
      font: helvetica,
      color: lightGray,
    });
    page.drawText(value || '—', {
      x: margin + 120,
      y: yPos,
      size: 11,
      font: bold ? helveticaBold : helvetica,
      color: textColor,
    });
    yPos -= 20;
  };

  // Dados da Coleta
  page.drawText('DADOS DA COLETA', {
    x: margin,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });
  yPos -= 25;

  drawField('ID da Coleta:', `#${pickup.id.slice(-8)}`, true);
  drawField('Status:', formatStatus(pickup.status));
  drawField('Criado em:', formatDate(pickup.createdAt));

  if (pickup.windowStart && pickup.windowEnd) {
    drawField('Janela de Coleta:', `${formatDateTime(pickup.windowStart)} até ${formatDateTime(pickup.windowEnd)}`);
  }
  if (pickup.scheduleAt) {
    drawField('Agendado para:', formatDateTime(pickup.scheduleAt));
  }

  yPos -= 15;

  // Origem
  page.drawText('ORIGEM', {
    x: margin,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });
  yPos -= 25;

  const companyName = pickup.user.hasCompany && pickup.user.razaoSocial
    ? pickup.user.razaoSocial
    : pickup.user.name || 'Não informado';
  drawField('Remetente:', companyName);
  if (pickup.user.hasCompany && pickup.user.cnpj) {
    drawField('CNPJ:', formatCNPJ(pickup.user.cnpj));
  }
  drawField('Endereço:', pickup.originAddress);
  drawField('Cidade/UF:', pickup.originCity && pickup.originUf ? `${pickup.originCity}/${pickup.originUf}` : null);
  drawField('CEP:', formatCEP(pickup.originCep));

  yPos -= 15;

  // Envio
  page.drawText('DADOS DO ENVIO', {
    x: margin,
    y: yPos,
    size: 12,
    font: helveticaBold,
    color: textColor,
  });
  yPos -= 25;

  drawField('Código Envio Legal:', pickup.shipment.platformTrackingCode, true);
  if (pickup.shipment.carrierTrackingCode) {
    drawField('Código Transportadora:', pickup.shipment.carrierTrackingCode);
  }
  drawField('Transportadora:', pickup.shipment.carrier);
  drawField('Serviço:', pickup.shipment.service);
  drawField('Destinatário:', pickup.shipment.recipientName);
  drawField('CEP Destino:', pickup.shipment.destinationCep ? formatCEP(pickup.shipment.destinationCep) : null);
  if (pickup.shipment.weight) {
    drawField('Peso:', `${pickup.shipment.weight} kg`);
  }

  yPos -= 15;

  // Observações
  if (pickup.notes) {
    page.drawText('OBSERVAÇÕES', {
      x: margin,
      y: yPos,
      size: 12,
      font: helveticaBold,
      color: textColor,
    });
    yPos -= 20;

    // Quebrar texto longo em múltiplas linhas
    const maxWidth = pageWidth - 2 * margin;
    const words = pickup.notes.split(' ');
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = helvetica.widthOfTextAtSize(testLine, 10);

      if (width > maxWidth) {
        page.drawText(line, {
          x: margin,
          y: yPos,
          size: 10,
          font: helvetica,
          color: textColor,
        });
        yPos -= 15;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      page.drawText(line, {
        x: margin,
        y: yPos,
        size: 10,
        font: helvetica,
        color: textColor,
      });
      yPos -= 15;
    }
  }

  // Rodapé
  const footerY = margin + 30;
  page.drawLine({
    start: { x: margin, y: footerY },
    end: { x: pageWidth - margin, y: footerY },
    thickness: 0.5,
    color: lightGray,
  });

  page.drawText(`Gerado em ${formatDateTime(new Date())} | envio.legal`, {
    x: margin,
    y: footerY - 15,
    size: 8,
    font: helvetica,
    color: lightGray,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: 'Pendente',
    SCHEDULED: 'Agendada',
    COMPLETED: 'Concluída',
    FAILED: 'Falhou',
    CANCELED: 'Cancelada',
  };
  return statusMap[status] || status;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

