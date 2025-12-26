import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { prisma } from '@/platform/db/db';
import { requireUser } from '@/platform/auth/require-session';
import { baixarRotuloPdf } from '@/platform/integrations/correios/prepostagem';
import { createEnvioLegalPdf } from '@/platform/labels/pdf-generator';
import {
  generateDeclaracaoConteudoPdf,
  type DeclaracaoConteudoPayload,
  type DeclaracaoConteudoItem,
} from '@/shared/docs/correios/declaracao-conteudo-pdf';

// Configurações de retry
const RETRY_CONFIG = {
  maxAttempts: 3,           // Número máximo de tentativas
  initialDelayMs: 1000,     // Delay inicial: 1 segundo
  maxDelayMs: 5000,         // Delay máximo: 5 segundos
  backoffMultiplier: 2,     // Multiplicador exponencial
};

/**
 * Executa uma função com retry e backoff exponencial
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
    onRetry?: (attempt: number, delay: number, error: unknown) => void;
  }
): Promise<T> {
  let lastError: unknown;
  let delay = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Verificar se deve tentar novamente
      if (attempt >= options.maxAttempts) {
        break;
      }

      if (options.shouldRetry && !options.shouldRetry(error, attempt)) {
        break;
      }

      // Callback de retry
      if (options.onRetry) {
        options.onRetry(attempt, delay, error);
      }

      // Aguardar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, delay));

      // Aumentar delay para próxima tentativa (exponential backoff)
      delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Baixa o PDF do rótulo com retry automático para falhas transientes
 */
async function baixarRotuloPdfComRetry(
  prePostageId: string,
  logger: { info: (msg: string, data?: Record<string, unknown>) => void; warn: (msg: string, data?: Record<string, unknown>) => void }
): Promise<{ success: boolean; content?: Buffer; erro?: string }> {
  return withRetry(
    async () => {
      const result = await baixarRotuloPdf(prePostageId);

      // Se não teve sucesso, lançar erro para acionar retry
      if (!result.success || !result.content) {
        const error = new Error(result.erro || 'Erro ao baixar PDF dos Correios');
        (error as Error & { isTransient?: boolean }).isTransient = true;
        throw error;
      }

      return result;
    },
    {
      ...RETRY_CONFIG,
      shouldRetry: (error, attempt) => {
        // Sempre tentar novamente para erros transientes
        const isTransient = (error as Error & { isTransient?: boolean })?.isTransient;
        return isTransient === true;
      },
      onRetry: (attempt, delay, error) => {
        logger.warn('label_pdf_retry', {
          prePostageId,
          attempt,
          delayMs: delay,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    }
  ).catch((error) => {
    // Retornar formato esperado em caso de falha após todas as tentativas
    return {
      success: false,
      erro: error instanceof Error ? error.message : 'Erro ao baixar PDF após múltiplas tentativas',
    };
  });
}

/**
 * GET /api/labels/[id]/pdf
 * Gera PDF da etiqueta com header Envio Legal + código de barras + PDF Correios
 * Inclui retry automático para falhas transientes da API dos Correios
 */
export const GET = withApiHandlerResponse<{ id: string }>(async (context) => {
  const { req, params, logger } = context;

  try {
    const session = await requireUser(req);

    const { id } = params;

    // 1. Buscar etiqueta com dados do shipment, packages e sender (para declaração)
    const label = await prisma.label.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            packages: {
              orderBy: { packageNumber: 'asc' },
            },
            sender: {
              include: {
                addresses: {
                  where: { isDefault: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!label) {
      return NextResponse.json({ message: 'Etiqueta não encontrada' }, { status: 404 });
    }

    // Verificar permissão
    if (label.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // 2. Obter o carrierPrePostageId do primeiro package
    const packages = label.shipment.packages;
    if (!packages.length) {
      return NextResponse.json(
        { message: 'Nenhum volume encontrado para esta etiqueta' },
        { status: 400 }
      );
    }

    // Buscar PDFs de todos os volumes (com retry automático)
    const pdfBuffers: Buffer[] = [];
    const errors: string[] = [];

    for (const pkg of packages) {
      const prePostageId = pkg.carrierPrePostageId;

      if (!prePostageId) {
        errors.push(`Volume ${pkg.packageNumber}: Pré-postagem não gerada`);
        continue;
      }

      logger.info('label_pdf_download_start', {
        labelId: id,
        packageId: pkg.id,
        packageNumber: pkg.packageNumber,
        prePostageId,
      });

      // Baixar PDF do Correios COM RETRY AUTOMÁTICO
      const rotuloResult = await baixarRotuloPdfComRetry(prePostageId, logger);

      if (!rotuloResult.success || !rotuloResult.content) {
        errors.push(`Volume ${pkg.packageNumber}: ${rotuloResult.erro || 'Erro ao baixar PDF'}`);
        continue;
      }

      pdfBuffers.push(rotuloResult.content);
    }

    if (pdfBuffers.length === 0) {
      return NextResponse.json(
        {
          message: 'Não foi possível gerar nenhum PDF',
          errors,
          hint: 'A API dos Correios pode estar temporariamente indisponível. Tente novamente em alguns segundos.',
        },
        { status: 400 }
      );
    }

    // 3. Criar PDF final com header Envio Legal
    const platformTrackingCode = label.shipment.platformTrackingCode || '';
    const labelPdf = await createEnvioLegalPdf({
      platformTrackingCode,
      correioPdfBuffers: pdfBuffers,
    });

    logger.info('label_pdf_generated', { labelId: id, volumeCount: pdfBuffers.length });

    // 4. Verificar se tem declaração de conteúdo e anexar ao PDF
    let finalPdf: Buffer | Uint8Array = labelPdf;
    const shipmentDoc = label.shipment.document as { type?: string; volumeDeclarations?: Array<{ volumeIndex?: number; items?: Array<{ descricao?: string; valorUnitario?: number; quantidade?: number }> }>; declarationItems?: Array<{ descricao?: string; valorUnitario?: number; quantidade?: number }> } | null;

    if (shipmentDoc?.type === 'DECLARACAO') {
      try {
        // Extrair itens da declaração
        const itens: DeclaracaoConteudoItem[] = [];

        // Formato novo: volumeDeclarations
        if (shipmentDoc.volumeDeclarations?.length) {
          for (const vol of shipmentDoc.volumeDeclarations) {
            if (vol.items?.length) {
              for (const item of vol.items) {
                if (item.descricao) {
                  itens.push({
                    descricao: item.descricao,
                    quantidade: item.quantidade || 1,
                    valor: (item.valorUnitario || 0) * (item.quantidade || 1),
                  });
                }
              }
            }
          }
        }

        // Formato legado: declarationItems
        if (itens.length === 0 && shipmentDoc.declarationItems?.length) {
          for (const item of shipmentDoc.declarationItems) {
            if (item.descricao) {
              itens.push({
                descricao: item.descricao,
                quantidade: item.quantidade || 1,
                valor: (item.valorUnitario || 0) * (item.quantidade || 1),
              });
            }
          }
        }

        if (itens.length > 0) {
          const sender = label.shipment.sender;
          const senderAddress = sender?.addresses?.[0];

          if (sender && senderAddress) {
            // Formatar endereço do remetente
            const formatEndereco = (addr: { logradouro: string; numero: string; complemento?: string | null; bairro: string }) => {
              const parts = [addr.logradouro];
              if (addr.numero) parts.push(addr.numero);
              if (addr.complemento) parts.push(addr.complemento);
              parts.push(`- ${addr.bairro}`);
              return parts.join(', ').replace(', -', ' -');
            };

            // Calcular peso total
            const pesoTotalKg = packages.reduce((sum, pkg) => sum + Number(pkg.weight), 0);

            // Montar payload da declaração
            const declaracaoPayload: DeclaracaoConteudoPayload = {
              remetente: {
                nome: sender.razaoSocial || sender.name || '—',
                documento: sender.cnpj || sender.cpf || null,
                endereco: formatEndereco(senderAddress),
                cidadeUf: `${senderAddress.cidade} - ${senderAddress.uf}`,
                cep: label.shipment.originCep,
              },
              destinatario: {
                nome: label.shipment.recipientName || '—',
                documento: label.shipment.recipientDocument || null,
                endereco: label.shipment.destinationAddress || '—',
                cidadeUf: `${label.shipment.destinationCity} - ${label.shipment.destinationState}`,
                cep: label.shipment.destinationCep,
              },
              itens,
              pesoTotalKg,
            };

            // Gerar PDF da declaração
            const declaracaoPdfBytes = await generateDeclaracaoConteudoPdf(declaracaoPayload);

            // Concatenar PDFs: etiqueta + declaração
            const labelPdfDoc = await PDFDocument.load(labelPdf);
            const declaracaoPdfDoc = await PDFDocument.load(declaracaoPdfBytes);

            const declaracaoPages = await labelPdfDoc.copyPages(
              declaracaoPdfDoc,
              declaracaoPdfDoc.getPageIndices()
            );

            for (const page of declaracaoPages) {
              labelPdfDoc.addPage(page);
            }

            finalPdf = await labelPdfDoc.save();

            logger.info('declaracao_conteudo_appended', {
              labelId: id,
              itemCount: itens.length,
              pesoTotalKg,
            });
          }
        }
      } catch (declaracaoError) {
        // Log erro mas não falha a geração da etiqueta
        logger.warn('declaracao_conteudo_error', {
          labelId: id,
          error: declaracaoError instanceof Error ? declaracaoError.message : String(declaracaoError),
        });
      }
    }

    // 5. Retornar PDF
    return new NextResponse(new Uint8Array(finalPdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etiqueta_${platformTrackingCode}.pdf"`,
        'Content-Length': String(finalPdf.length),
      },
    });
  } catch (error) {
    logger.error('label_pdf_error', { err: error });
    const message = error instanceof Error ? error.message : 'Erro ao gerar PDF da etiqueta';
    return NextResponse.json({ message }, { status: 500 });
  }
});

/**
 * HEAD /api/labels/[id]/pdf
 * Verifica se a etiqueta está disponível para download
 */
export const HEAD = withApiHandlerResponse<{ id: string }>(async (context) => {
  const { req, params, logger } = context;

  try {
    const session = await requireUser(req);

    const { id } = params;

    // Buscar etiqueta básica
    const label = await prisma.label.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            packages: {
              select: { carrierPrePostageId: true },
            },
          },
        },
      },
    });

    if (!label) {
      return new NextResponse(null, { status: 404 });
    }

    if (label.shipment.senderId !== session.userId) {
      return new NextResponse(null, { status: 403 });
    }

    // Verificar se tem pré-postagem gerada
    const hasPrePostage = label.shipment.packages.some(p => p.carrierPrePostageId);
    if (!hasPrePostage) {
      return NextResponse.json(
        { message: 'Pré-postagem não gerada para este envio' },
        { status: 400 }
      );
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    logger.error('label_pdf_head_error', { err: error });
    return new NextResponse(null, { status: 500 });
  }
});
