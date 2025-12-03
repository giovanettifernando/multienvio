/**
 * Módulo de Pré-Postagem (PPN) dos Correios
 *
 * Responsabilidades:
 * - Criar lote de pré-postagem
 * - Obter código de rastreio (SRO)
 * - Gerar/baixar etiquetas (PDF/ZPL)
 *
 * Referência: Manual de Pré-Postagem CWS
 *
 * Fluxo típico:
 * 1. POST /prepostagem/v2/prepostagens → criar lote
 * 2. GET /prepostagem/v2/prepostagens/{idLote} → consultar status e obter códigos SRO
 * 3. GET /prepostagem/v2/etiquetas/{codigoObjeto}?formato=pdf → baixar etiqueta
 */

import { correiosFetch, getCorreiosConfig } from './client';
import {
  type CorreiosPrePostagemObjeto,
  type CorreiosPrePostagemLoteRequest,
  type CorreiosPrePostagemLoteResponse,
  type CorreiosDestinatario,
  type CorreiosRemetente,
  type CorreiosEtiquetaResponse,
  CorreiosApiError,
  CorreiosValidationError,
} from './types';
import { CORREIOS_ENDPOINTS, SERVICO_ADICIONAL, TIPO_OBJETO } from './constants';

// ============================================================================
// Tipos Internos
// ============================================================================

export interface CreatePrePostagemInput {
  // Serviço dos Correios
  codigoServico: string;

  // Peso e dimensões
  pesoGramas: number;
  alturaCm?: number;
  larguraCm?: number;
  comprimentoCm?: number;

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

  // Remetente
  remetente: {
    nome: string;
    documento?: string;
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

  // Opcionais
  valorDeclarado?: number;
  conteudo?: string;
  descricaoObjeto?: string;
  chavesNFe?: string[];
  servicosAdicionais?: string[];
}

export interface PrePostagemResult {
  success: boolean;
  idLote?: string;
  codigoRastreio?: string;      // SRO (ex: NX000000000BR)
  idObjeto?: string;
  status?: string;
  erros?: Array<{ codigo: string; mensagem: string }>;
  bruto?: unknown;
}

export interface EtiquetaResult {
  success: boolean;
  codigoRastreio: string;
  content?: Buffer;
  contentType?: string;
  fileName?: string;
  erro?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normaliza CEP removendo caracteres não numéricos
 */
function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Converte input interno para formato da API dos Correios
 */
function buildObjetoPostal(input: CreatePrePostagemInput): CorreiosPrePostagemObjeto {
  // Montar destinatário
  const destinatario: CorreiosDestinatario = {
    nome: input.destinatario.nome.substring(0, 60), // Limite de 60 chars
    cpfCnpj: input.destinatario.documento?.replace(/\D/g, ''),
    telefone: input.destinatario.telefone?.replace(/\D/g, ''),
    email: input.destinatario.email,
    endereco: {
      cep: normalizeCep(input.destinatario.cep),
      logradouro: input.destinatario.logradouro.substring(0, 50),
      numero: input.destinatario.numero?.substring(0, 8),
      complemento: input.destinatario.complemento?.substring(0, 30),
      bairro: input.destinatario.bairro?.substring(0, 30),
      cidade: input.destinatario.cidade.substring(0, 30),
      uf: input.destinatario.uf.toUpperCase(),
    },
  };

  // Montar remetente
  const remetente: CorreiosRemetente = {
    nome: input.remetente.nome.substring(0, 60),
    cpfCnpj: input.remetente.documento?.replace(/\D/g, ''),
    telefone: input.remetente.telefone?.replace(/\D/g, ''),
    email: input.remetente.email,
    endereco: {
      cep: normalizeCep(input.remetente.cep),
      logradouro: input.remetente.logradouro?.substring(0, 50),
      numero: input.remetente.numero?.substring(0, 8),
      complemento: input.remetente.complemento?.substring(0, 30),
      bairro: input.remetente.bairro?.substring(0, 30),
      cidade: input.remetente.cidade?.substring(0, 30),
      uf: input.remetente.uf?.toUpperCase(),
    },
  };

  // Montar serviços adicionais
  const servicosAdicionais: Array<{
    codigoServicoAdicional: string;
    valorDeclarado?: number;
  }> = [];

  if (input.servicosAdicionais) {
    for (const codigo of input.servicosAdicionais) {
      servicosAdicionais.push({ codigoServicoAdicional: codigo });
    }
  }

  // Adicionar valor declarado se informado
  if (input.valorDeclarado && input.valorDeclarado > 0) {
    const hasVD = servicosAdicionais.some(
      (s) => s.codigoServicoAdicional === SERVICO_ADICIONAL.VALOR_DECLARADO
    );

    if (!hasVD) {
      servicosAdicionais.push({
        codigoServicoAdicional: SERVICO_ADICIONAL.VALOR_DECLARADO,
        valorDeclarado: input.valorDeclarado,
      });
    }
  }

  // Montar objeto postal
  const objeto: CorreiosPrePostagemObjeto = {
    codigoServico: input.codigoServico,
    pesoInformado: Math.round(input.pesoGramas),
    alturaInformada: input.alturaCm ? Math.round(input.alturaCm) : undefined,
    larguraInformada: input.larguraCm ? Math.round(input.larguraCm) : undefined,
    comprimentoInformado: input.comprimentoCm ? Math.round(input.comprimentoCm) : undefined,
    destinatario,
    remetente,
    valorDeclarado: input.valorDeclarado,
    conteudo: input.conteudo?.substring(0, 100),
    descricaoObjeto: input.descricaoObjeto?.substring(0, 200),
    servicosAdicionais: servicosAdicionais.length > 0 ? servicosAdicionais : undefined,
  };

  // Adicionar NF-e se houver
  if (input.chavesNFe && input.chavesNFe.length > 0) {
    objeto.notasFiscais = input.chavesNFe.map((chave) => ({
      chaveNFe: chave.replace(/\D/g, ''), // Apenas números
    }));
  }

  return objeto;
}

// ============================================================================
// Criação de Pré-Postagem
// ============================================================================

/**
 * Cria um lote de pré-postagem com um ou mais objetos
 *
 * @param objetos Array de objetos para pré-postagem
 * @returns Resultado com idLote e códigos de rastreio
 */
export async function criarLotePrePostagem(
  objetos: CreatePrePostagemInput[]
): Promise<PrePostagemResult[]> {
  if (objetos.length === 0) {
    throw new CorreiosValidationError('Nenhum objeto informado para pré-postagem');
  }

  const config = getCorreiosConfig();

  // Converter objetos para formato da API
  const objetosPostais = objetos.map(buildObjetoPostal);

  const request: CorreiosPrePostagemLoteRequest = {
    idCorreios: `ppn_${Date.now()}`,
    codigoRemetente: config.cartaoPostagem,
    objetosPostais,
  };

  console.log('[CORREIOS_PREPOSTAGEM] Creating pre-postagem:', {
    idCorreios: request.idCorreios,
    quantidadeObjetos: objetosPostais.length,
    servicos: objetosPostais.map((o) => o.codigoServico),
    endpoint: CORREIOS_ENDPOINTS.prePostagemCriar,
    apiBase: config.apiBase,
    fullUrl: `${config.apiBase}${CORREIOS_ENDPOINTS.prePostagemCriar}`,
    requestBody: JSON.stringify(request, null, 2), // Log full request for debugging
  });

  try {
    const response = await correiosFetch<CorreiosPrePostagemLoteResponse>(
      CORREIOS_ENDPOINTS.prePostagemCriar,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    console.log('[CORREIOS_PREPOSTAGEM] Batch created:', {
      idLote: response.idLote,
      status: response.status,
      objetos: response.objetosPostais?.length || 0,
    });

    // Processar resultados
    const results: PrePostagemResult[] = [];

    if (response.objetosPostais) {
      for (const obj of response.objetosPostais) {
        const result: PrePostagemResult = {
          success: !!obj.codigoObjeto,
          idLote: response.idLote,
          codigoRastreio: obj.codigoObjeto,
          idObjeto: obj.idObjeto,
          status: obj.status,
          bruto: obj,
        };

        if (obj.erros && obj.erros.length > 0) {
          result.success = false;
          result.erros = obj.erros.map((e) => ({
            codigo: e.codigo,
            mensagem: e.mensagem,
          }));
        }

        results.push(result);
      }
    }

    // Se não retornou objetos mas tem idLote, criar resultado genérico
    if (results.length === 0 && response.idLote) {
      results.push({
        success: true,
        idLote: response.idLote,
        status: response.status,
        bruto: response,
      });
    }

    // Verificar erros no nível do lote
    if (response.erros && response.erros.length > 0) {
      console.error('[CORREIOS_PREPOSTAGEM] Batch errors:', response.erros);

      // Se não tem resultados, criar um com os erros
      if (results.length === 0) {
        results.push({
          success: false,
          erros: response.erros.map((e) => ({
            codigo: e.codigo,
            mensagem: e.mensagem,
          })),
          bruto: response,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[CORREIOS_PREPOSTAGEM] Failed to create batch:', error);

    // Capturar detalhes do erro da API dos Correios
    let errorDetails: unknown = null;
    if (error instanceof CorreiosApiError && error.errorDetails) {
      errorDetails = error.errorDetails;
      console.error('[CORREIOS_PREPOSTAGEM] API error details:', error.errorDetails);
    }

    // Retornar erro para cada objeto com detalhes da API
    return objetos.map(() => ({
      success: false,
      erros: [{
        codigo: 'API_ERROR',
        mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
      }],
      bruto: errorDetails, // Incluir resposta bruta do erro da API
    }));
  }
}

/**
 * Cria pré-postagem para um único objeto (wrapper conveniente)
 */
export async function criarPrePostagem(
  input: CreatePrePostagemInput
): Promise<PrePostagemResult> {
  const results = await criarLotePrePostagem([input]);
  return results[0] || {
    success: false,
    erros: [{ codigo: 'UNKNOWN', mensagem: 'Nenhum resultado retornado' }],
  };
}

// ============================================================================
// Consulta de Lote
// ============================================================================

/**
 * Consulta status de um lote de pré-postagem
 *
 * Útil quando o código de rastreio não é retornado imediatamente
 */
export async function consultarLotePrePostagem(
  idLote: string
): Promise<PrePostagemResult[]> {
  console.log('[CORREIOS_PREPOSTAGEM] Querying batch:', { idLote });

  try {
    const response = await correiosFetch<CorreiosPrePostagemLoteResponse>(
      `${CORREIOS_ENDPOINTS.prePostagemConsulta}/${idLote}`,
      {
        method: 'GET',
      }
    );

    const results: PrePostagemResult[] = [];

    if (response.objetosPostais) {
      for (const obj of response.objetosPostais) {
        results.push({
          success: !!obj.codigoObjeto,
          idLote: response.idLote,
          codigoRastreio: obj.codigoObjeto,
          idObjeto: obj.idObjeto,
          status: obj.status,
          erros: obj.erros?.map((e) => ({ codigo: e.codigo, mensagem: e.mensagem })),
          bruto: obj,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[CORREIOS_PREPOSTAGEM] Failed to query batch:', error);
    throw error;
  }
}

// ============================================================================
// Etiquetas
// ============================================================================

export type EtiquetaFormato = 'pdf' | 'zpl';

/**
 * Baixa etiqueta de postagem para um código de rastreio
 *
 * @param codigoRastreio Código SRO (ex: NX000000000BR)
 * @param formato Formato desejado: 'pdf' ou 'zpl'
 * @returns Buffer com conteúdo da etiqueta
 */
export async function baixarEtiqueta(
  codigoRastreio: string,
  formato: EtiquetaFormato = 'pdf'
): Promise<EtiquetaResult> {
  console.log('[CORREIOS_PREPOSTAGEM] Downloading label:', {
    codigoRastreio,
    formato,
  });

  try {
    const response = await correiosFetch<CorreiosEtiquetaResponse>(
      `${CORREIOS_ENDPOINTS.prePostagemEtiqueta}/${codigoRastreio}?formato=${formato}`,
      {
        method: 'GET',
      }
    );

    return {
      success: true,
      codigoRastreio,
      content: response.content,
      contentType: response.contentType,
      fileName: `etiqueta_${codigoRastreio}.${formato}`,
    };
  } catch (error) {
    console.error('[CORREIOS_PREPOSTAGEM] Failed to download label:', error);

    return {
      success: false,
      codigoRastreio,
      erro: error instanceof Error ? error.message : 'Erro ao baixar etiqueta',
    };
  }
}

/**
 * Baixa etiquetas para múltiplos códigos de rastreio
 *
 * @param codigos Array de códigos SRO
 * @param formato Formato desejado
 * @returns Array de resultados
 */
export async function baixarEtiquetasLote(
  codigos: string[],
  formato: EtiquetaFormato = 'pdf'
): Promise<EtiquetaResult[]> {
  // Baixar em paralelo (limite de concorrência para não sobrecarregar)
  const CONCURRENT_LIMIT = 3;
  const results: EtiquetaResult[] = [];

  for (let i = 0; i < codigos.length; i += CONCURRENT_LIMIT) {
    const batch = codigos.slice(i, i + CONCURRENT_LIMIT);
    const batchResults = await Promise.all(
      batch.map((codigo) => baixarEtiqueta(codigo, formato))
    );
    results.push(...batchResults);
  }

  return results;
}

// ============================================================================
// Fluxo Completo de Pré-Postagem
// ============================================================================

export interface FullPrePostagemResult extends PrePostagemResult {
  etiqueta?: {
    content: Buffer;
    contentType: string;
    fileName: string;
  };
}

/**
 * Executa fluxo completo de pré-postagem:
 * 1. Cria pré-postagem
 * 2. Baixa etiqueta (se código de rastreio disponível)
 *
 * @param input Dados do objeto
 * @param formato Formato da etiqueta
 * @returns Resultado com código de rastreio e etiqueta
 */
export async function prePostagemCompleta(
  input: CreatePrePostagemInput,
  formato: EtiquetaFormato = 'pdf'
): Promise<FullPrePostagemResult> {
  // 1. Criar pré-postagem
  const prePostagemResult = await criarPrePostagem(input);

  if (!prePostagemResult.success || !prePostagemResult.codigoRastreio) {
    return prePostagemResult;
  }

  // 2. Aguardar um momento para o sistema processar (se necessário)
  // Em alguns casos, a etiqueta pode não estar disponível imediatamente
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 3. Baixar etiqueta
  const etiquetaResult = await baixarEtiqueta(
    prePostagemResult.codigoRastreio,
    formato
  );

  const result: FullPrePostagemResult = {
    ...prePostagemResult,
  };

  if (etiquetaResult.success && etiquetaResult.content) {
    result.etiqueta = {
      content: etiquetaResult.content,
      contentType: etiquetaResult.contentType || 'application/pdf',
      fileName: etiquetaResult.fileName || `etiqueta_${prePostagemResult.codigoRastreio}.pdf`,
    };
  } else {
    // Log do erro mas não falha a operação (rastreio já foi gerado)
    console.warn('[CORREIOS_PREPOSTAGEM] Label download failed:', {
      codigoRastreio: prePostagemResult.codigoRastreio,
      erro: etiquetaResult.erro,
    });
  }

  return result;
}
