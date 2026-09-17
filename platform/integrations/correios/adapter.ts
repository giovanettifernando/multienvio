/**
 * Adapter para integração dos Correios com o sistema de cotação do Multienvio
 *
 * Responsabilidades:
 * - Converter tipos internos do Multienvio para formato da API dos Correios
 * - Converter respostas dos Correios para tipos internos
 * - Integrar com o fluxo de cotação existente
 * - Integrar com o fluxo de criação de envio (pré-postagem)
 */

import type { QuoteResultItem } from '@/shared/types/quote';
import type { QuoteRequest } from '@/shared/validation/quote-backend';
// Import directly from specific files to avoid circular dependency with index.ts
import {
  cotarCorreiosDefault,
  cotarMultiVolumeCorreios,
  getCorreiosServicos,
} from './precoPrazo';
import {
  criarPrePostagem,
  prePostagemCompleta,
  type CreatePrePostagemInput,
  type PrePostagemResult,
  type FullPrePostagemResult,
} from './prepostagem';
import {
  isCorreiosConfigured,
  getCorreiosConfigAsync,
  validateCorreiosConfig,
} from './client';
import {
  type CorreiosPrecoPrazoInput,
  type CorreiosCotacaoCompleta,
  type CorreiosVolumeQuoteInput,
  type CorreiosMultiVolumeQuoteResult,
  CorreiosApiError,
} from './types';
import { servicoAceitaValorDeclarado } from './constants';
import { correiosVolumeValidator } from './correios-volume-validator';
import type { VolumeInput, CarrierEligibility, VolumeValidationResult } from '../shared/volume-eligibility';

// ============================================================================
// Constantes
// ============================================================================

export const CORREIOS_CARRIER_ID = 'correios';
export const CORREIOS_CARRIER_NAME = 'Correios';

// ============================================================================
// Tipos Internos
// ============================================================================

export interface CorreiosQuoteInput {
  origemCep: string;
  destinoCep: string;
  volumes: Array<{
    pesoKg: number;
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
  }>;
  valorDeclarado?: number;
  servicosAdicionais?: string[];
}

export interface CorreiosShipmentInput {
  codigoServico: string;

  // Volume (dados consolidados)
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;

  // Remetente (documento é OBRIGATÓRIO para PPN v1)
  remetente: {
    nome: string;
    documento: string;   // CPF ou CNPJ - OBRIGATÓRIO
    telefone?: string;
    email?: string;
    cep: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };

  // Destinatário
  destinatario: {
    nome: string;
    documento?: string;
    telefone?: string;
    email?: string;
    cep: string;
    logradouro: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade: string;
    uf: string;
  };

  // Opcionais
  valorDeclarado?: number;
  conteudo?: string;
  chavesNFe?: string[];
}

export interface CorreiosShipmentResult {
  success: boolean;
  codigoRastreio?: string;
  etiquetaBase64?: string;
  etiquetaContentType?: string;
  erros?: Array<{ codigo: string; mensagem: string }>;
  bruto?: unknown;
}

// ============================================================================
// Conversão de Tipos
// ============================================================================

/**
 * Converte QuoteRequest do Multienvio para input dos Correios
 */
export function quoteRequestToCorreiosInput(request: QuoteRequest): CorreiosPrecoPrazoInput {
  // Calcular peso total em gramas
  const pesoTotalGramas = request.volumes.reduce(
    (sum, vol) => sum + vol.pesoKg * 1000,
    0
  );

  // Calcular dimensões consolidadas (maior volume ou soma)
  // Para os Correios, usamos o maior volume como referência
  let maxComprimento = 0;
  let maxLargura = 0;
  let maxAltura = 0;

  for (const vol of request.volumes) {
    maxComprimento = Math.max(maxComprimento, vol.comprimentoCm);
    maxLargura = Math.max(maxLargura, vol.larguraCm);
    maxAltura = Math.max(maxAltura, vol.alturaCm);
  }

  // Garantir dimensões mínimas (Correios exige mínimo 11x2x16 cm)
  maxComprimento = Math.max(maxComprimento, 16);
  maxLargura = Math.max(maxLargura, 11);
  maxAltura = Math.max(maxAltura, 2);

  return {
    cepOrigem: request.origem.cep.replace(/\D/g, ''),
    cepDestino: request.destino.cep.replace(/\D/g, ''),
    pesoGramas: pesoTotalGramas,
    comprimentoCm: maxComprimento,
    larguraCm: maxLargura,
    alturaCm: maxAltura,
    valorDeclarado: request.seguro ?? undefined,
  };
}

/**
 * Converte cotação dos Correios para QuoteResultItem do Multienvio
 */
export function correiosCotacaoToQuoteResult(
  cotacao: CorreiosCotacaoCompleta
): QuoteResultItem {
  // Gerar ID único para a opção
  const id = `${CORREIOS_CARRIER_ID}-${cotacao.codigoServicoCorreios}`;

  return {
    id,
    carrier: CORREIOS_CARRIER_NAME,
    modalidade: cotacao.nomeServico,
    prazoDias: cotacao.prazoDias,
    preco: cotacao.precoTotal,
    exigeSeguro: false, // Correios não exige seguro obrigatório
    aceitaSeguro: servicoAceitaValorDeclarado(cotacao.codigoServicoCorreios),
    source: 'real',
  };
}

/**
 * Converte input de shipment do Multienvio para CreatePrePostagemInput
 */
export function shipmentInputToPrePostagem(
  input: CorreiosShipmentInput
): CreatePrePostagemInput {
  return {
    codigoServico: input.codigoServico,
    pesoGramas: input.pesoGramas,
    alturaCm: input.alturaCm,
    larguraCm: input.larguraCm,
    comprimentoCm: input.comprimentoCm,
    destinatario: {
      nome: input.destinatario.nome,
      documento: input.destinatario.documento,
      telefone: input.destinatario.telefone,
      email: input.destinatario.email,
      cep: input.destinatario.cep,
      logradouro: input.destinatario.logradouro,
      numero: input.destinatario.numero,
      complemento: input.destinatario.complemento,
      bairro: input.destinatario.bairro,
      cidade: input.destinatario.cidade,
      uf: input.destinatario.uf,
    },
    remetente: {
      nome: input.remetente.nome,
      documento: input.remetente.documento,
      telefone: input.remetente.telefone,
      email: input.remetente.email,
      cep: input.remetente.cep,
      logradouro: input.remetente.logradouro,
      numero: input.remetente.numero,
      complemento: input.remetente.complemento,
      bairro: input.remetente.bairro,
      cidade: input.remetente.cidade,
      uf: input.remetente.uf,
    },
    valorDeclarado: input.valorDeclarado,
    conteudo: input.conteudo,
    chavesNFe: input.chavesNFe,
  };
}

// ============================================================================
// Funções de Integração
// ============================================================================

/**
 * Verifica se a integração dos Correios está disponível (versão síncrona)
 * NOTA: Pode retornar false na primeira chamada se o cache do DB não foi carregado
 */
export function isCorreiosAvailable(): boolean {
  return isCorreiosConfigured();
}

/**
 * Verifica se a integração dos Correios está disponível (versão assíncrona)
 * Esta versão carrega a config do banco de dados se necessário
 */
export async function isCorreiosAvailableAsync(): Promise<boolean> {
  const config = await getCorreiosConfigAsync();
  const validation = validateCorreiosConfig(config);
  return validation.valid;
}

/**
 * Converte resultado de multi-volume para QuoteResultItem
 */
function multiVolumeResultToQuoteResult(
  result: CorreiosMultiVolumeQuoteResult
): QuoteResultItem {
  const id = `${CORREIOS_CARRIER_ID}-${result.serviceCode}`;

  return {
    id,
    carrier: CORREIOS_CARRIER_NAME,
    modalidade: result.serviceName,
    prazoDias: result.deliveryDays,
    preco: result.totalPrice,
    exigeSeguro: false,
    aceitaSeguro: servicoAceitaValorDeclarado(result.serviceCode),
    source: 'real',
  };
}

/**
 * Resultado da cotação dos Correios com informações de elegibilidade
 */
export type CorreiosQuoteResult = {
  results: QuoteResultItem[];
  source: 'real' | 'error';
  error?: string;
  eligibility?: CarrierEligibility;
};

/**
 * Obtém cotações dos Correios para uma requisição do Multienvio
 *
 * IMPORTANTE:
 * - Verifica elegibilidade dos volumes ANTES de chamar a API
 * - Se algum volume não atender as regras, retorna vazio com info de elegibilidade
 * - Cada volume é cotado individualmente e os preços são somados
 *
 * @param request Requisição de cotação do Multienvio
 * @returns Resultado com cotações e informações de elegibilidade
 */
export async function quoteFromCorreios(
  request: QuoteRequest
): Promise<CorreiosQuoteResult> {
  const requestId = `correios_${Date.now()}`;

  console.log('[CORREIOS_ADAPTER] Starting quote:', {
    requestId,
    origem: request.origem.cep,
    destino: request.destino.cep,
    volumes: request.volumes.length,
  });

  // 1. Converter volumes para formato de validação
  const volumeInputs: VolumeInput[] = request.volumes.map((vol, index) => ({
    index,
    comprimentoCm: vol.comprimentoCm,
    larguraCm: vol.larguraCm,
    alturaCm: vol.alturaCm,
    pesoKg: vol.pesoKg,
  }));

  // 2. Validar elegibilidade de todos os volumes
  const volumeValidations = volumeInputs.map((v) =>
    correiosVolumeValidator.validateVolume(v)
  );
  const isEligible = volumeValidations.every((r) => r.isValid);

  // Construir objeto de elegibilidade
  const eligibility: CarrierEligibility = {
    carrierId: correiosVolumeValidator.carrierId,
    carrierName: correiosVolumeValidator.carrierName,
    isEligible,
    volumeResults: volumeValidations,
    overallReasons: isEligible
      ? []
      : [...new Set(volumeValidations.flatMap((r) => r.reasons))],
  };

  // 3. Se não elegível, retornar vazio com informações de validação
  if (!isEligible) {
    console.log('[CORREIOS_ADAPTER] Volumes not eligible:', {
      requestId,
      invalidVolumes: volumeValidations
        .filter((r) => !r.isValid)
        .map((r) => ({
          index: r.volumeIndex,
          reasons: r.reasons,
        })),
    });

    return {
      results: [],
      source: 'real', // Não é erro, é decisão de negócio
      eligibility,
    };
  }

  // 4. Verificar se integração está configurada
  const isConfigured = await isCorreiosAvailableAsync();
  if (!isConfigured) {
    console.warn('[CORREIOS_ADAPTER] Integration not configured');
    return {
      results: [],
      source: 'error',
      error: 'INTEGRATION_DISABLED',
      eligibility,
    };
  }

  try {
    // 5. Converter volumes para formato CorreiosVolumeQuoteInput
    // Agora usamos os valores originais pois já validamos que atendem os mínimos
    const volumesInput: CorreiosVolumeQuoteInput[] = request.volumes.map((vol, index) => ({
      packageNumber: index + 1,
      weight: vol.pesoKg,
      width: vol.larguraCm,
      height: vol.alturaCm,
      length: vol.comprimentoCm,
    }));

    // 6. Cotar cada volume individualmente e somar os preços
    const multiVolumeResults = await cotarMultiVolumeCorreios(
      request.origem.cep.replace(/\D/g, ''),
      request.destino.cep.replace(/\D/g, ''),
      volumesInput,
      request.seguro ?? undefined
    );

    // 7. Converter para formato do Multienvio
    const results = multiVolumeResults
      .filter((r) => r.totalPrice > 0 && !r.hasErrors)
      .map(multiVolumeResultToQuoteResult);

    console.log('[CORREIOS_ADAPTER] Quote completed (multi-volume):', {
      requestId,
      total: results.length,
      volumesCount: request.volumes.length,
      servicos: results.map((r) => ({ modalidade: r.modalidade, preco: r.preco })),
    });

    return {
      results,
      source: 'real',
      eligibility,
    };
  } catch (error) {
    console.error('[CORREIOS_ADAPTER] Quote failed:', {
      requestId,
      error: error instanceof Error ? error.message : error,
    });

    return {
      results: [],
      source: 'error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      eligibility,
    };
  }
}

/**
 * Extrai o código de serviço dos Correios a partir do serviceId
 *
 * @param serviceId ID do serviço selecionado (ex: "correios-03220")
 * @returns Código do serviço dos Correios (ex: "03220")
 */
export function extractCorreiosServiceCode(serviceId: string): string | null {
  if (!serviceId.startsWith(CORREIOS_CARRIER_ID + '-')) {
    return null;
  }

  return serviceId.replace(CORREIOS_CARRIER_ID + '-', '');
}

/**
 * Verifica se um serviceId é dos Correios
 */
export function isCorreiosService(serviceId: string): boolean {
  return serviceId.startsWith(CORREIOS_CARRIER_ID + '-');
}

/**
 * Obtém o nome de exibição do serviço dos Correios
 */
export function getCorreiosServiceName(codigoServico: string): string {
  const servicos = getCorreiosServicos();
  const servico = servicos.find((s) => s.codigoServico === codigoServico);
  return servico?.nomeExibicao || `Correios ${codigoServico}`;
}

/**
 * Cria envio nos Correios (pré-postagem) e retorna código de rastreio + etiqueta
 *
 * @param input Dados do envio
 * @returns Resultado com código de rastreio e etiqueta em base64
 */
export async function createCorreiosShipment(
  input: CorreiosShipmentInput
): Promise<CorreiosShipmentResult> {
  const requestId = `correios_ship_${Date.now()}`;

  console.log('[CORREIOS_ADAPTER] Creating shipment:', {
    requestId,
    servico: input.codigoServico,
    destinoCep: input.destinatario.cep,
  });

  // Verificar se integração está configurada (usa versão async para carregar config do DB)
  const isConfigured = await isCorreiosAvailableAsync();
  if (!isConfigured) {
    console.warn('[CORREIOS_ADAPTER] Integration not configured');
    return {
      success: false,
      erros: [{ codigo: 'INTEGRATION_DISABLED', mensagem: 'Integração dos Correios não configurada' }],
    };
  }

  try {
    // Converter para formato da API
    const prePostagemInput = shipmentInputToPrePostagem(input);

    // Criar pré-postagem com etiqueta
    const result = await prePostagemCompleta(prePostagemInput, 'pdf');

    if (!result.success) {
      return {
        success: false,
        erros: result.erros,
        bruto: result.bruto,
      };
    }

    // Converter etiqueta para base64 se disponível
    let etiquetaBase64: string | undefined;
    let etiquetaContentType: string | undefined;

    if (result.etiqueta?.content) {
      etiquetaBase64 = result.etiqueta.content.toString('base64');
      etiquetaContentType = result.etiqueta.contentType;
    }

    console.log('[CORREIOS_ADAPTER] Shipment created:', {
      requestId,
      codigoRastreio: result.codigoRastreio,
      hasEtiqueta: !!etiquetaBase64,
    });

    return {
      success: true,
      codigoRastreio: result.codigoRastreio,
      etiquetaBase64,
      etiquetaContentType,
      bruto: result.bruto,
    };
  } catch (error) {
    console.error('[CORREIOS_ADAPTER] Shipment creation failed:', {
      requestId,
      error: error instanceof Error ? error.message : error,
    });

    return {
      success: false,
      erros: [{
        codigo: 'API_ERROR',
        mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
      }],
    };
  }
}

/**
 * Cria envio nos Correios a partir de dados do checkout do Multienvio
 *
 * Esta função é usada no fluxo de checkout quando o usuário
 * seleciona um serviço dos Correios.
 */
export async function createCorreiosShipmentFromCheckout(params: {
  serviceId: string;
  volumes: Array<{
    peso: number;  // kg
    altura: number;
    largura: number;
    comprimento: number;
  }>;
  remetente: {
    nome: string;
    documento: string;   // CPF ou CNPJ - OBRIGATÓRIO para PPN v1
    telefone?: string;
    email?: string;
    cep: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
  destinatario: {
    nome: string;
    documento?: string;
    telefone?: string;
    email?: string;
    cep: string;
    logradouro: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade: string;
    uf: string;
  };
  valorDeclarado?: number;
  conteudo?: string;
  chavesNFe?: string[];
}): Promise<CorreiosShipmentResult> {
  // Extrair código do serviço
  const codigoServico = extractCorreiosServiceCode(params.serviceId);

  if (!codigoServico) {
    return {
      success: false,
      erros: [{
        codigo: 'INVALID_SERVICE',
        mensagem: `ServiceId inválido para Correios: ${params.serviceId}`,
      }],
    };
  }

  // Validar documento do remetente (obrigatório para PPN v1)
  if (!params.remetente.documento) {
    return {
      success: false,
      erros: [{
        codigo: 'MISSING_DOCUMENT',
        mensagem: 'CPF/CNPJ do remetente é obrigatório para pré-postagem',
      }],
    };
  }

  // Calcular peso total em gramas
  const pesoGramas = params.volumes.reduce(
    (sum, vol) => sum + vol.peso * 1000,
    0
  );

  // Usar dimensões do primeiro volume (ou maior)
  const volume = params.volumes[0] || { altura: 2, largura: 11, comprimento: 16 };

  return createCorreiosShipment({
    codigoServico,
    pesoGramas,
    alturaCm: Math.max(volume.altura, 2),
    larguraCm: Math.max(volume.largura, 11),
    comprimentoCm: Math.max(volume.comprimento, 16),
    remetente: params.remetente,
    destinatario: params.destinatario,
    valorDeclarado: params.valorDeclarado,
    conteudo: params.conteudo,
    chavesNFe: params.chavesNFe,
  });
}
