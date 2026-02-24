/**
 * GET /api/shipments/[id]/declaracao-conteudo
 *
 * Gera e retorna PDF da Declaração de Conteúdo no padrão dos Correios.
 * Disponível apenas para envios com document.type === 'DECLARACAO'.
 */

import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import {
  generateDeclaracaoConteudoPdf,
  type DeclaracaoConteudoPayload,
  type DeclaracaoConteudoItem,
} from '@/shared/docs/correios/declaracao-conteudo-pdf';
import { isCorreiosCarrier } from '@/shared/utils/carrier';
import { extractDeclarationItems, type ShipmentDocument } from '@/shared/docs/correios/declaration-items';
import { formatEndereco } from '@/shared/utils/address';

export const maxDuration = 30; // 30 segundos para gerar o PDF

export const GET = withApiHandlerResponse(async ({ req, params, logger }) => {
  const session = await requireUserSession(req);
  const shipmentId = params.id;

  // Buscar shipment com dados necessários
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      packages: true,
      sender: {
        include: {
          addresses: {
            where: { isDefault: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!shipment) {
    throw new ApiError({ code: 'NOT_FOUND', message: 'Envio não encontrado', status: 404 });
  }

  // Verificar se pertence ao usuário
  if (shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'FORBIDDEN', message: 'Acesso negado', status: 403 });
  }

  // Verificar se é Correios
  if (!isCorreiosCarrier(shipment.carrier)) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Declaração de conteúdo disponível apenas para envios Correios',
      status: 400,
    });
  }

  // Verificar se tem declaração de conteúdo
  const document = shipment.document as ShipmentDocument | null;
  if (!document || document.type !== 'DECLARACAO') {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Este envio não possui declaração de conteúdo',
      status: 400,
    });
  }

  // Extrair itens da declaração
  const itens = extractDeclarationItems(document);
  if (itens.length === 0) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Nenhum item encontrado na declaração de conteúdo',
      status: 400,
    });
  }

  // Montar dados do remetente
  const sender = shipment.sender;
  const senderAddress = sender.addresses[0];

  if (!senderAddress) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Remetente não possui endereço cadastrado',
      status: 400,
    });
  }

  // Calcular peso total
  const pesoTotalKg = shipment.packages.reduce((sum, pkg) => sum + Number(pkg.weight), 0);

  // Montar payload para geração do PDF
  const payload: DeclaracaoConteudoPayload = {
    remetente: {
      nome: sender.razaoSocial || sender.name || '—',
      documento: sender.cnpj || sender.cpf || null,
      endereco: formatEndereco(senderAddress),
      cidadeUf: `${senderAddress.cidade} - ${senderAddress.uf}`,
      cep: shipment.originCep,
    },
    destinatario: {
      nome: shipment.recipientName || '—',
      documento: shipment.recipientDocument || null,
      endereco: shipment.destinationAddress || '—',
      cidadeUf: `${shipment.destinationCity} - ${shipment.destinationState}`,
      cep: shipment.destinationCep,
    },
    itens,
    pesoTotalKg,
  };

  // Gerar PDF
  const pdfBytes = await generateDeclaracaoConteudoPdf(payload);

  logger.info('declaracao_conteudo_pdf_generated', {
    shipmentId,
    userId: session.userId,
    itemCount: itens.length,
    pesoTotalKg,
  });

  // Determinar se é download ou preview
  const { searchParams } = new URL(req.url);
  const isDownload = searchParams.get('download') === 'true';

  const disposition = isDownload
    ? `attachment; filename="declaracao-conteudo-${shipment.platformTrackingCode}.pdf"`
    : `inline; filename="declaracao-conteudo-${shipment.platformTrackingCode}.pdf"`;

  // Retornar PDF (converter Uint8Array para Buffer)
  const buffer = Buffer.from(pdfBytes);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Content-Length': buffer.length.toString(),
    },
  });
});
