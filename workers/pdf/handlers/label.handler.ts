/**
 * Handler: Label PDF Generation
 *
 * Extrai a lógica de geração de PDF de etiqueta de app/api/labels/[id]/pdf/route.ts.
 * Gera PDF com header Multienvio + códigos de barras + PDFs dos Correios.
 * Opcionalmente anexa Declaração de Conteúdo.
 */

import { PDFDocument } from 'pdf-lib';
import { prisma } from '../../../platform/db/db';
import {
  baixarRotuloPdf,
  criarPrePostagemIndividual,
  buscarPrePostagemPorRastreio,
} from '../../../platform/integrations/correios/prepostagem';
import {
  getCorreiosConfigAsync,
  validateCorreiosConfig,
} from '../../../platform/integrations/correios/client';
import { printLoggiLabel } from '../../../platform/integrations/loggi/label';
import { createMultienvioPdf } from '../../../platform/labels/pdf-generator';
// Usados apenas pelo anexo da declaração em papel, desativado em 01/09/2026.
// Ver o bloco comentado mais abaixo.
// import { buildRemetente, buildDestinatario } from '@/modules/shipments/application/declaracao-parties';
// import {
//   generateDeclaracaoConteudoPdf,
//   type DeclaracaoConteudoPayload,
// } from '../../../shared/docs/correios/declaracao-conteudo-pdf';
import type { JobLogger } from '../../../platform/queue/helpers';
import { withRetry, CORREIOS_RETRY_CONFIG } from '../../../shared/utils/retry';
import { CorreiosApiError } from '../../../platform/integrations/correios/types';
// extractDeclarationItems idem — só o tipo segue em uso.
import { type ShipmentDocument } from '../../../shared/docs/correios/declaration-items';

async function baixarRotuloPdfComRetry(
  prePostageId: string,
  log: JobLogger
): Promise<{ success: boolean; content?: Buffer; erro?: string }> {
  return withRetry(
    async () => {
      const result = await baixarRotuloPdf(prePostageId);
      if (!result.success || !result.content) {
        throw new Error(result.erro || 'Erro ao baixar PDF dos Correios');
      }
      return result;
    },
    {
      ...CORREIOS_RETRY_CONFIG,
      // Não retentar quando circuit breaker está aberto: ele gerencia a recuperação
      // sozinho (resetTimeoutMs: 15s) e os retries (~3s) nunca alcançam esse window.
      shouldRetry: (error) => {
        if (error instanceof CorreiosApiError && error.errorCode === 'CIRCUIT_BREAKER_OPEN') {
          return false;
        }
        return true;
      },
      onRetry: (attempt, delay, error) => {
        log.warn({ prePostageId, attempt, delayMs: delay, error: error instanceof Error ? error.message : String(error) },
          'Retrying Correios PDF download');
      },
    }
  ).catch((error) => ({
    success: false,
    erro: error instanceof Error ? error.message : 'Erro ao baixar PDF após múltiplas tentativas',
  }));
}

// Mapeamento de serviço → código (espelhado de carrier-integration.ts)
const CORREIOS_SERVICE_CODE_MAP: Record<string, string> = {
  'PAC': '03298',
  'SEDEX': '03220',
  'SEDEX 10': '03158',
  'SEDEX 12': '03140',
  'SEDEX HOJE': '03204',
  'MINI ENVIOS': '04227',
};

/**
 * Resolve o código do serviço a partir do shipment.service ou carrierMetadata
 */
function resolveServiceCode(shipment: { service?: string | null; carrierMetadata?: unknown }): string | null {
  // 1. Tentar via carrierMetadata.serviceCode
  const meta = shipment.carrierMetadata as Record<string, unknown> | null;
  if (meta?.serviceCode && typeof meta.serviceCode === 'string' && /^\d{5}$/.test(meta.serviceCode)) {
    return meta.serviceCode;
  }

  // 2. Tentar via shipment.service
  const svc = shipment.service;
  if (!svc) return null;

  if (/^\d{5}$/.test(svc)) return svc;

  const normalized = svc.toUpperCase().trim();
  if (CORREIOS_SERVICE_CODE_MAP[normalized]) return CORREIOS_SERVICE_CODE_MAP[normalized];

  if (normalized.includes('PAC')) return CORREIOS_SERVICE_CODE_MAP['PAC'];
  if (normalized.includes('SEDEX 10')) return CORREIOS_SERVICE_CODE_MAP['SEDEX 10'];
  if (normalized.includes('SEDEX 12')) return CORREIOS_SERVICE_CODE_MAP['SEDEX 12'];
  if (normalized.includes('SEDEX HOJE')) return CORREIOS_SERVICE_CODE_MAP['SEDEX HOJE'];
  if (normalized.includes('SEDEX')) return CORREIOS_SERVICE_CODE_MAP['SEDEX'];
  if (normalized.includes('MINI')) return CORREIOS_SERVICE_CODE_MAP['MINI ENVIOS'];

  return null;
}

/**
 * Tenta recuperar/criar a pré-postagem para um pacote que não tem carrierPrePostageId.
 *
 * Estratégias (em ordem):
 * 1. Se o pacote tem carrierTrackingCode, buscar a pré-postagem no Correios
 * 2. Se não, criar uma nova pré-postagem on-demand com dados do shipment
 *
 * Atualiza o banco de dados se conseguir recuperar.
 */
async function recoverMissingPrePostage(
  shipment: {
    id: string;
    service?: string | null;
    carrier?: string | null;
    carrierTrackingCode?: string | null;
    carrierMetadata?: unknown;
    originCep: string;
    destinationCep: string;
    destinationAddress?: string | null;
    destinationNeighborhood?: string | null;
    destinationCity: string;
    destinationState: string;
    recipientName?: string | null;
    recipientDocument?: string | null;
    recipientPhone?: string | null;
    recipientEmail?: string | null;
    declaredValue: number;
    sender: {
      name?: string | null;
      razaoSocial?: string | null;
      cpf?: string | null;
      cnpj?: string | null;
      addresses: Array<{
        logradouro?: string | null;
        numero?: string | null;
        complemento?: string | null;
        bairro?: string | null;
        cidade?: string | null;
        uf?: string | null;
      }>;
    };
  },
  pkg: { id: string; packageNumber: number; carrierTrackingCode?: string | null; weight: number; width: number; height: number; length: number },
  log: JobLogger,
): Promise<string | null> {
  // Verificar se Correios está configurado (DB ou env)
  try {
    const config = await getCorreiosConfigAsync();
    const validation = validateCorreiosConfig(config);
    if (!validation.valid) {
      log.warn({ errors: validation.errors }, 'Correios not configured — cannot recover pre-postage');
      return null;
    }
  } catch {
    log.warn({}, 'Failed to validate Correios config for recovery');
    return null;
  }

  // Estratégia 1: buscar pelo código de rastreio
  if (pkg.carrierTrackingCode) {
    log.info({ trackingCode: pkg.carrierTrackingCode, packageNumber: pkg.packageNumber },
      'Attempting to recover pre-postage ID by tracking code');
    try {
      const searchResult = await buscarPrePostagemPorRastreio(pkg.carrierTrackingCode);
      if (searchResult.success && searchResult.idPrePostagem) {
        await prisma.package.update({
          where: { id: pkg.id },
          data: { carrierPrePostageId: searchResult.idPrePostagem },
        });
        log.info({ prePostageId: searchResult.idPrePostagem, trackingCode: pkg.carrierTrackingCode },
          'Pre-postage ID recovered from Correios search');
        return searchResult.idPrePostagem;
      }
    } catch (err) {
      log.warn({ error: err instanceof Error ? err.message : String(err) },
        'Failed to search pre-postage by tracking code');
    }
  }

  // Estratégia 2: criar pré-postagem on-demand
  const serviceCode = resolveServiceCode(shipment);
  if (!serviceCode) {
    log.warn({ service: shipment.service }, 'Cannot create on-demand pre-postage: service code not resolved');
    return null;
  }

  const sender = shipment.sender;
  const senderAddress = sender?.addresses?.[0];
  if (!sender || !senderAddress) {
    log.warn({}, 'Cannot create on-demand pre-postage: sender address not available');
    return null;
  }

  const senderDoc = ((sender.cnpj && sender.cnpj.trim()) || sender.cpf || '').replace(/\D/g, '');
  if (!senderDoc) {
    log.warn({}, 'Cannot create on-demand pre-postage: sender document (CPF/CNPJ) not available');
    return null;
  }

  log.info({ packageNumber: pkg.packageNumber, serviceCode },
    'Creating on-demand pre-postage for package');

  try {
    const result = await criarPrePostagemIndividual({
      codigoServico: serviceCode,
      pesoGramas: Math.round(Number(pkg.weight) * 1000),
      alturaCm: Math.round(Number(pkg.height)),
      larguraCm: Math.round(Number(pkg.width)),
      comprimentoCm: Math.round(Number(pkg.length)),
      tipoObjeto: 2,
      destinatario: (() => {
        // Parse do endereço concatenado: "logradouro, numero, complemento"
        const destParts = (shipment.destinationAddress || '').split(',').map((s) => s.trim());
        return {
          nome: shipment.recipientName || 'Destinatário',
          documento: shipment.recipientDocument?.replace(/\D/g, ''),
          telefone: shipment.recipientPhone || undefined,
          email: shipment.recipientEmail || undefined,
          cep: shipment.destinationCep.replace(/\D/g, ''),
          logradouro: destParts[0] || '',
          numero: destParts[1] || 'S/N',
          complemento: destParts[2] || undefined,
          bairro: shipment.destinationNeighborhood || undefined,
          cidade: shipment.destinationCity,
          uf: shipment.destinationState,
        };
      })(),
      remetente: {
        nome: sender.razaoSocial || sender.name || 'Remetente',
        documento: senderDoc,
        cep: shipment.originCep.replace(/\D/g, ''),
        logradouro: senderAddress.logradouro || undefined,
        numero: senderAddress.numero || undefined,
        complemento: senderAddress.complemento || undefined,
        bairro: senderAddress.bairro || undefined,
        cidade: senderAddress.cidade || undefined,
        uf: senderAddress.uf || undefined,
      },
      valorDeclarado: shipment.declaredValue > 0 ? shipment.declaredValue : undefined,
      itensDeclaracaoConteudo: [{
        conteudo: 'Mercadorias diversas',
        quantidade: 1,
        valor: shipment.declaredValue > 0 ? shipment.declaredValue : 50,
      }],
    });

    if (!result.success || !result.idObjeto) {
      const errMsg = result.erros?.map((e) => e.mensagem).join('; ') || 'Falha desconhecida';
      log.warn({ errors: result.erros }, `On-demand pre-postage creation failed: ${errMsg}`);
      return null;
    }

    // Atualizar pacote no banco
    await prisma.package.update({
      where: { id: pkg.id },
      data: {
        carrierPrePostageId: result.idObjeto,
        carrierTrackingCode: result.codigoRastreio || pkg.carrierTrackingCode,
      },
    });

    // Se é o primeiro volume e o shipment não tem tracking code, atualizar
    if (pkg.packageNumber === 1 && !shipment.carrierTrackingCode && result.codigoRastreio) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { carrierTrackingCode: result.codigoRastreio },
      });
      await prisma.label.updateMany({
        where: { shipmentId: shipment.id },
        data: { trackingCode: result.codigoRastreio },
      });
    }

    log.info({
      packageNumber: pkg.packageNumber,
      prePostageId: result.idObjeto,
      trackingCode: result.codigoRastreio,
    }, 'On-demand pre-postage created successfully');

    return result.idObjeto;
  } catch (err) {
    log.error({ error: err instanceof Error ? err.message : String(err) },
      'Exception during on-demand pre-postage creation');
    return null;
  }
}

export async function generateLabelPdf(params: {
  labelId: string;
  log: JobLogger;
}): Promise<{ pdfBuffer: Buffer; fileName: string }> {
  const { labelId, log } = params;

  // 1. Buscar label + shipment + packages + sender
  const label = await prisma.label.findUnique({
    where: { id: labelId },
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
    throw new Error(`Label ${labelId} não encontrada`);
  }

  const packages = label.shipment.packages;
  if (!packages.length) {
    throw new Error(`Nenhum volume encontrado para a etiqueta ${labelId}`);
  }

  // 2. Obter PDFs — se label já tem fileBase64 (Loggi/J&T), usar diretamente
  const pdfBuffers: Buffer[] = [];
  const errors: string[] = [];
  let hasExpiredLabel = false;

  const carrier = (label.shipment.carrier || '').toLowerCase();

  if (label.fileBase64) {
    // Label already has a pre-generated PDF (Loggi, J&T, etc.)
    log.info({ labelId }, 'Using pre-generated label PDF from fileBase64');
    pdfBuffers.push(Buffer.from(label.fileBase64, 'base64'));
  } else if (carrier === 'loggi') {
    // Loggi: tentar buscar etiqueta via API (pode não estar pronta se async)
    const loggiKeys = packages
      .map((p) => p.carrierPrePostageId)
      .filter((k): k is string => k != null);

    if (loggiKeys.length === 0) {
      throw new Error('Nenhum loggiKey encontrado nos pacotes. Integração com Loggi pode ter falhado.');
    }

    log.info({ labelId, loggiKeys }, 'Fetching Loggi label PDF');

    try {
      const labelResponse = await printLoggiLabel(loggiKeys, 'LABEL_LAYOUT_A4');

      if (labelResponse.success?.content) {
        pdfBuffers.push(Buffer.from(labelResponse.success.content, 'base64'));

        // Salvar no label para uso futuro (evita nova chamada à API)
        await prisma.label.update({
          where: { id: labelId },
          data: { fileBase64: labelResponse.success.content, contentType: 'application/pdf' },
        });

        log.info({ labelId }, 'Loggi label PDF fetched and cached');
      } else {
        throw new Error('Etiqueta Loggi em processamento. Tente novamente em alguns minutos.');
      }
    } catch (loggiError) {
      const msg = loggiError instanceof Error ? loggiError.message : String(loggiError);
      log.warn({ labelId, error: msg }, 'Loggi label not available yet');
      throw new Error(`Etiqueta Loggi não disponível: ${msg}`);
    }
  } else if (carrier && carrier !== 'correios' && !carrier.includes('correio')) {
    // Transportadora que não é Correios nem Loggi (J&T, Total Express) e cujo
    // PDF ainda não foi salvo em fileBase64.
    //
    // Antes isto caía no `else` dos Correios e o usuário recebia "não foi
    // possível criar a pré-postagem nos Correios — verifique as credenciais"
    // num envio da J&T. Mensagem que manda investigar o lugar errado.
    log.warn({ labelId, carrier }, 'Label not ready for non-Correios carrier');
    errors.push(
      `A etiqueta da ${label.shipment.carrier} ainda não foi disponibilizada pela transportadora. ` +
      `Aguarde alguns minutos e tente novamente.`
    );
  } else {
    // Correios: download PDFs per volume via pre-postage
    for (const pkg of packages) {
      let prePostageId = pkg.carrierPrePostageId;

      // Recovery: tentar recuperar/criar pré-postagem se não existir
      if (!prePostageId) {
        log.warn({ labelId, packageId: pkg.id, packageNumber: pkg.packageNumber },
          'carrierPrePostageId missing — attempting recovery');

        prePostageId = await recoverMissingPrePostage(label.shipment, pkg, log);
      }

      if (!prePostageId) {
        const shipmentStatus = label.shipment.status;
        let hint: string;
        if (shipmentStatus === 'PROCESSING') {
          hint = 'A integração com os Correios ainda está em andamento. Aguarde alguns minutos e tente novamente.';
        } else if (shipmentStatus === 'CREATION_FAILED') {
          hint = 'A integração com os Correios falhou. Verifique se as credenciais dos Correios estão configuradas corretamente.';
        } else {
          hint = 'Não foi possível criar a pré-postagem nos Correios. Verifique as credenciais e tente novamente.';
        }
        errors.push(`Volume ${pkg.packageNumber}: ${hint}`);
        continue;
      }

      log.info({ labelId, packageId: pkg.id, packageNumber: pkg.packageNumber, prePostageId },
        'Downloading Correios PDF');

      const rotuloResult = await baixarRotuloPdfComRetry(prePostageId, log);

      if (!rotuloResult.success || !rotuloResult.content) {
        const rawError = rotuloResult.erro || '';
        const isExpired = rawError.includes('não encontrado na resposta') || rawError.includes('404');
        if (isExpired) hasExpiredLabel = true;
        const userMessage = isExpired
          ? 'Etiqueta expirada nos Correios. Será necessário gerar um novo envio.'
          : 'Não foi possível baixar a etiqueta dos Correios. Tente novamente em alguns minutos.';
        errors.push(`Volume ${pkg.packageNumber}: ${userMessage}`);
        continue;
      }

      pdfBuffers.push(rotuloResult.content);
    }
  }

  if (pdfBuffers.length === 0) {
    if (hasExpiredLabel) {
      throw new Error('[LABEL_EXPIRED]Etiqueta expirada nos Correios. Será necessário gerar um novo envio.');
    }
    throw new Error(`Não foi possível gerar nenhum PDF. Erros: ${errors.join('; ')}`);
  }

  // 3. Criar PDF com header Multienvio
  const platformTrackingCode = label.shipment.platformTrackingCode || '';
  let finalPdf: Buffer | Uint8Array = await createMultienvioPdf({
    platformTrackingCode,
    correioPdfBuffers: pdfBuffers,
    // O QR da DC-e precisa estar visível na embalagem. Substitui o anexo da
    // declaração em papel, desativado logo abaixo.
    dceKey: label.shipment.dceKey,
  });

  log.info({ labelId, volumeCount: pdfBuffers.length }, 'Label PDF composed');

  /* DESATIVADO EM 01/09/2026 — a declaração de conteúdo em papel foi
     substituída pela DC-e, que o cliente emite na SEFAZ e cujo QR-Code vai na
     etiqueta. Anexar o papel aqui entregaria um documento sem validade.

     Mantido comentado, e não removido, para reativar sem reescrever caso o
     papel volte a ser aceito ou precise conviver com a DC-e em alguma praça.

  // 4. Anexar Declaração de Conteúdo (se aplicável)
  const shipmentDoc = label.shipment.document as ShipmentDocument | null;

  if (shipmentDoc?.type === 'DECLARACAO') {
    try {
      const itens = extractDeclarationItems(shipmentDoc);

      if (itens.length > 0) {
        const sender = label.shipment.sender ?? null;
        const senderAddress = sender?.addresses?.[0] ?? null;

        {
          const pesoTotalKg = packages.reduce((sum, pkg) => sum + Number(pkg.weight), 0);

          // Mesma origem de dados do download avulso da declaracao: o endereco
          // congelado no envio, com o cadastro apenas como reserva.
          const declaracaoPayload: DeclaracaoConteudoPayload = {
            remetente: buildRemetente(label.shipment, sender, senderAddress),
            destinatario: buildDestinatario(label.shipment),
            itens,
            pesoTotalKg,
          };

          const declaracaoPdfBytes = await generateDeclaracaoConteudoPdf(declaracaoPayload);

          const labelPdfDoc = await PDFDocument.load(finalPdf);
          const declaracaoPdfDoc = await PDFDocument.load(declaracaoPdfBytes);
          const declaracaoPages = await labelPdfDoc.copyPages(declaracaoPdfDoc, declaracaoPdfDoc.getPageIndices());

          for (const page of declaracaoPages) {
            labelPdfDoc.addPage(page);
          }

          finalPdf = Buffer.from(await labelPdfDoc.save());
          log.info({ labelId, itemCount: itens.length, pesoTotalKg }, 'Declaration appended to label PDF');
        }
      }
    } catch (declaracaoError) {
      log.warn({ labelId, error: declaracaoError instanceof Error ? declaracaoError.message : String(declaracaoError) },
        'Failed to append declaration — continuing without it');
    }
  }
  */

  const fileName = `etiqueta_${platformTrackingCode || labelId}.pdf`;
  return { pdfBuffer: Buffer.from(finalPdf), fileName };
}
