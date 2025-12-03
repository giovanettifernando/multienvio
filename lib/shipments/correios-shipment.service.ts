/**
 * Serviço de criação de envios via Correios
 *
 * Responsabilidades:
 * - Integrar criação de envio no checkout com API de Pré-Postagem dos Correios
 * - Obter código de rastreio real (SRO) dos Correios
 * - Baixar e armazenar etiqueta de postagem
 *
 * Fluxo:
 * 1. Checkout cria o Shipment com status inicial
 * 2. Após pagamento confirmado, este serviço é chamado
 * 3. Cria pré-postagem nos Correios
 * 4. Atualiza Shipment com código de rastreio real
 * 5. Atualiza Label com etiqueta dos Correios
 */

import { prisma } from '@/lib/db';
import {
  createCorreiosShipmentFromCheckout,
  isCorreiosService,
  extractCorreiosServiceCode,
  getCorreiosServiceName,
  CORREIOS_CARRIER_NAME,
} from '@/lib/integrations/carriers/correiosAdapter';
import { isCorreiosConfigured } from '@/lib/integrations/correios';

// ============================================================================
// Tipos
// ============================================================================

export interface CorreiosShipmentContext {
  shipmentId: string;
  userId: string;
}

export interface ProcessCorreiosShipmentResult {
  success: boolean;
  codigoRastreio?: string;
  etiquetaAtualizada?: boolean;
  erro?: string;
}

// ============================================================================
// Serviço Principal
// ============================================================================

/**
 * Processa um envio via Correios após pagamento confirmado
 *
 * Esta função deve ser chamada após o pagamento ser confirmado
 * para gerar o código de rastreio real e a etiqueta dos Correios.
 *
 * @param context Contexto do shipment
 * @returns Resultado do processamento
 */
export async function processCorreiosShipment(
  context: CorreiosShipmentContext
): Promise<ProcessCorreiosShipmentResult> {
  const { shipmentId, userId } = context;

  console.log('[CORREIOS_SHIPMENT] Processing shipment:', { shipmentId });

  // 1. Buscar shipment com dados completos
  const shipment = await prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      senderId: userId,
    },
    include: {
      sender: {
        include: {
          addresses: {
            where: { isDefault: true },
            take: 1,
          },
        },
      },
      label: true,
      packages: true,
    },
  });

  if (!shipment) {
    return {
      success: false,
      erro: 'Shipment não encontrado',
    };
  }

  // 2. Verificar se já tem código de rastreio dos Correios
  if (shipment.carrierTrackingCode && shipment.carrierTrackingCode.match(/^[A-Z]{2}\d{9}[A-Z]{2}$/)) {
    console.log('[CORREIOS_SHIPMENT] Already has tracking code:', shipment.carrierTrackingCode);
    return {
      success: true,
      codigoRastreio: shipment.carrierTrackingCode,
      etiquetaAtualizada: false,
    };
  }

  // 3. Verificar se é realmente um serviço dos Correios
  // O serviceId é armazenado no label ou derivado do carrier
  const serviceId = shipment.label?.service
    ? `correios-${shipment.label.service}`
    : null;

  // Também verificar se carrier é Correios
  const isCorreios = shipment.carrier?.toLowerCase() === 'correios' ||
                     (serviceId && isCorreiosService(serviceId));

  if (!isCorreios) {
    return {
      success: false,
      erro: `Shipment não é dos Correios: ${shipment.carrier}`,
    };
  }

  // 4. Verificar se integração está configurada
  if (!isCorreiosConfigured()) {
    console.warn('[CORREIOS_SHIPMENT] Integration not configured');
    return {
      success: false,
      erro: 'Integração dos Correios não configurada',
    };
  }

  // 5. Montar dados para pré-postagem
  const senderAddress = shipment.sender?.addresses?.[0];

  // Extrair documento do remetente (OBRIGATÓRIO para PPN v1)
  const remetenteDocumento = shipment.sender?.cpf || shipment.sender?.cnpj;
  if (!remetenteDocumento) {
    console.error('[CORREIOS_SHIPMENT] Missing sender document (CPF/CNPJ)');
    return {
      success: false,
      erro: 'CPF/CNPJ do remetente é obrigatório para pré-postagem dos Correios',
    };
  }

  // Extrair código do serviço
  const codigoServico = shipment.label?.service ||
                        extractCorreiosServiceCode(serviceId || '') ||
                        '03298'; // PAC como fallback

  // Extrair dados do documento (NFe keys se houver)
  const document = shipment.document as Record<string, unknown> | null;
  let chavesNFe: string[] | undefined;

  if (document?.type === 'NFE') {
    // Novo formato: packages com chave
    if (document.packages && Array.isArray(document.packages)) {
      chavesNFe = (document.packages as Array<{ chave?: string }>)
        .map((p) => p.chave)
        .filter((c): c is string => !!c);
    }
    // Formato legado: nfeKeys
    else if (document.nfeKeys && Array.isArray(document.nfeKeys)) {
      chavesNFe = document.nfeKeys as string[];
    }
  }

  // Calcular peso total em gramas
  const pesoGramas = shipment.packages.reduce(
    (sum, pkg) => sum + (Number(pkg.weight) || 0) * 1000,
    0
  ) || (Number(shipment.weight) || 0.5) * 1000;

  // Dimensões do primeiro pacote
  const firstPkg = shipment.packages[0];
  const alturaCm = firstPkg?.height || 10;
  const larguraCm = firstPkg?.width || 10;
  const comprimentoCm = firstPkg?.length || 10;

  try {
    // 6. Chamar API dos Correios para criar pré-postagem
    const result = await createCorreiosShipmentFromCheckout({
      serviceId: `correios-${codigoServico}`,
      volumes: shipment.packages.map((pkg) => ({
        peso: Number(pkg.weight) || 0.5,
        altura: pkg.height || 10,
        largura: pkg.width || 10,
        comprimento: pkg.length || 10,
      })),
      remetente: {
        nome: shipment.sender?.name || 'Remetente',
        documento: remetenteDocumento,
        telefone: shipment.sender?.phone || undefined,
        email: shipment.sender?.email || undefined,
        cep: shipment.originCep,
        logradouro: senderAddress?.logradouro || undefined,
        numero: senderAddress?.numero || undefined,
        complemento: senderAddress?.complemento || undefined,
        bairro: senderAddress?.bairro || undefined,
        cidade: senderAddress?.cidade || undefined,
        uf: senderAddress?.uf || undefined,
      },
      destinatario: {
        nome: shipment.recipientName || 'Destinatário',
        documento: shipment.recipientDocument || undefined,
        telefone: shipment.recipientPhone || undefined,
        email: shipment.recipientEmail || undefined,
        cep: shipment.destinationCep || '',
        logradouro: shipment.destinationAddress || 'Não informado',
        numero: undefined, // Está junto no destinationAddress
        complemento: undefined,
        bairro: shipment.destinationNeighborhood || undefined,
        cidade: shipment.destinationCity || 'Não informada',
        uf: shipment.destinationState || 'XX',
      },
      valorDeclarado: Number(shipment.declaredValue) || undefined,
      conteudo: 'Mercadoria',
      chavesNFe,
    });

    if (!result.success || !result.codigoRastreio) {
      console.error('[CORREIOS_SHIPMENT] Pre-posting failed:', result.erros);
      return {
        success: false,
        erro: result.erros?.[0]?.mensagem || 'Erro ao criar pré-postagem',
      };
    }

    // 7. Atualizar Shipment com código de rastreio real
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        carrierTrackingCode: result.codigoRastreio,
      },
    });

    // 8. Atualizar Label com etiqueta dos Correios
    let etiquetaAtualizada = false;

    if (shipment.label && result.etiquetaBase64) {
      await prisma.label.update({
        where: { id: shipment.label.id },
        data: {
          trackingCode: result.codigoRastreio,
          fileBase64: result.etiquetaBase64,
          contentType: result.etiquetaContentType || 'application/pdf',
          sizeBytes: Buffer.from(result.etiquetaBase64, 'base64').length,
          status: 'issued',
        },
      });
      etiquetaAtualizada = true;
    }

    console.log('[CORREIOS_SHIPMENT] Successfully processed:', {
      shipmentId,
      codigoRastreio: result.codigoRastreio,
      etiquetaAtualizada,
    });

    return {
      success: true,
      codigoRastreio: result.codigoRastreio,
      etiquetaAtualizada,
    };
  } catch (error) {
    console.error('[CORREIOS_SHIPMENT] Error:', error);
    return {
      success: false,
      erro: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Verifica se um shipment é dos Correios e precisa de processamento
 */
export function shouldProcessAsCorreios(carrier: string, service?: string): boolean {
  const carrierLower = carrier.toLowerCase();

  if (carrierLower === 'correios') {
    return true;
  }

  if (service && isCorreiosService(service)) {
    return true;
  }

  return false;
}

/**
 * Tenta processar shipment como Correios de forma assíncrona (fire-and-forget)
 *
 * Útil para chamar após o checkout sem bloquear a resposta
 */
export function processCorreiosShipmentAsync(
  context: CorreiosShipmentContext
): void {
  // Fire and forget - não bloqueia
  processCorreiosShipment(context)
    .then((result) => {
      if (!result.success) {
        console.error('[CORREIOS_SHIPMENT_ASYNC] Failed:', result.erro);
      }
    })
    .catch((error) => {
      console.error('[CORREIOS_SHIPMENT_ASYNC] Error:', error);
    });
}
