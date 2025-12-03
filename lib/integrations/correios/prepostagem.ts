/**
 * Módulo de Pré-Postagem (PPN) dos Correios
 *
 * Responsabilidades:
 * - Criar pré-postagem individual
 * - Gerar rótulo (etiqueta) com código de rastreio
 * - Baixar documentos adicionais (declaração, AR)
 *
 * Referência: Manual de Pré-Postagem CWS - Seção 5.3
 *
 * Fluxo de Pré-Postagem Individual:
 * 1. POST /prepostagem/v1/prepostagens → criar pré-postagem (retorna ID)
 * 2. POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf → gerar rótulo PDF
 *
 * Gerenciamento:
 * - GET /v2/prepostagens → listar/consultar pré-postagens
 * - GET /prepostagem/v1/prepostagens/declaracaoconteudo/{ids} → declaração
 * - GET /prepostagem/v1/prepostagens/avisorecebimento/{ids} → AR
 */

import { correiosFetch, getCorreiosConfig } from './client';
import {
  type CorreiosPrePostagemObjeto,
  type CorreiosPrePostagemRequest,
  type CorreiosPrePostagemLoteRequest,
  type CorreiosPrePostagemLoteResponse,
  type CorreiosPrePostagemIndividualResponse,
  type CorreiosRotuloRequest,
  type CorreiosRotuloResponse,
  type CorreiosDestinatario,
  type CorreiosRemetente,
  type CorreiosEtiquetaResponse,
  CorreiosApiError,
  CorreiosValidationError,
} from './types';
import { CORREIOS_ENDPOINTS, SERVICO_ADICIONAL } from './constants';

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

  // Tipo de objeto (1=Envelope, 2=Caixa/Pacote, 3=Rolo/Prisma)
  // Se não informado, será deduzido das dimensões (2=Caixa como padrão)
  tipoObjeto?: number;

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

  // Declaração de Conteúdo (obrigatório se não tiver NF-e)
  itensDeclaracaoConteudo?: Array<{
    conteudo: string;      // Descrição do item
    quantidade: number;
    valor: number;         // Valor unitário em reais
  }>;

  // Indica se contém objetos proibidos (padrão: false)
  objetosProibidos?: boolean;

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
 *
 * IMPORTANTE: Estrutura FLAT conforme documentação oficial CWS!
 * - Todos os campos ficam na RAIZ do request
 * - NÃO usar wrapper "objeto"
 * - Nomes de campos específicos:
 *   - pesoInformado (não "peso")
 *   - codigoFormatoObjetoInformado (não "formatoObjeto")
 *   - cienteObjetoNaoProibido (não "objetosProibidos")
 *   - alturaInformada, larguraInformada, comprimentoInformado (não "dimensao")
 */
function buildPrePostagemRequest(input: CreatePrePostagemInput): CorreiosPrePostagemRequest {
  // Montar destinatário
  const destinatario: CorreiosDestinatario = {
    nome: input.destinatario.nome.substring(0, 60),
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

  // Determinar formato do objeto (padrão: 2 = Caixa/Pacote)
  // Valores: "1"=Envelope, "2"=Caixa/Pacote, "3"=Rolo/Prisma
  const codigoFormatoObjetoInformado = String(input.tipoObjeto ?? 2);

  // Peso em gramas como STRING
  const pesoInformado = String(Math.round(input.pesoGramas));

  // Dimensões como STRING
  const alturaInformada = input.alturaCm ? String(Math.round(input.alturaCm)) : undefined;
  const larguraInformada = input.larguraCm ? String(Math.round(input.larguraCm)) : undefined;
  const comprimentoInformado = input.comprimentoCm ? String(Math.round(input.comprimentoCm)) : undefined;

  // Montar Declaração de Conteúdo (obrigatório se não tiver NF-e)
  // IMPORTANTE: Todos os campos devem ser STRING!
  let itensDeclaracaoConteudo: Array<{
    conteudo: string;
    quantidade: string;
    valor: string;
  }> | undefined;

  if (input.itensDeclaracaoConteudo && input.itensDeclaracaoConteudo.length > 0) {
    itensDeclaracaoConteudo = input.itensDeclaracaoConteudo.map((item) => ({
      conteudo: item.conteudo.substring(0, 100),
      quantidade: String(item.quantidade),
      valor: String(item.valor),
    }));
  } else if (!input.chavesNFe || input.chavesNFe.length === 0) {
    // Se não tem NF-e e não tem declaração, criar uma declaração padrão
    itensDeclaracaoConteudo = [{
      conteudo: input.conteudo || input.descricaoObjeto || 'Mercadoria',
      quantidade: '1',
      valor: String(input.valorDeclarado || 1),
    }];
  }

  // Montar NF-e se houver
  let listaNotaFiscal: Array<{ chaveNFe: string }> | undefined;
  if (input.chavesNFe && input.chavesNFe.length > 0) {
    listaNotaFiscal = input.chavesNFe.map((chave) => ({
      chaveNFe: chave.replace(/\D/g, ''),
    }));
  }

  // Montar request completo com estrutura FLAT
  // IMPORTANTE: Todos os campos na RAIZ, sem wrapper "objeto"!
  const request: CorreiosPrePostagemRequest = {
    // Serviço
    codigoServico: input.codigoServico,

    // Partes
    remetente,
    destinatario,

    // Peso e formato - OBRIGATÓRIOS, como STRING
    pesoInformado,                           // Ex: "500"
    codigoFormatoObjetoInformado,            // Ex: "2"

    // Dimensões - como STRING
    alturaInformada,                         // Ex: "10"
    larguraInformada,                        // Ex: "15"
    comprimentoInformado,                    // Ex: "20"

    // Flag de objetos proibidos - OBRIGATÓRIO
    cienteObjetoNaoProibido: '1',            // "1" = ciente que não contém objetos proibidos

    // Declaração de Conteúdo
    itensDeclaracaoConteudo,

    // Valor declarado (opcional)
    valorDeclarado: input.valorDeclarado ? String(input.valorDeclarado) : undefined,

    // NF-e (opcional)
    listaNotaFiscal,
  };

  return request;
}

// ============================================================================
// Criação de Pré-Postagem Individual (Fluxo v1)
// ============================================================================

/**
 * Cria uma pré-postagem individual
 * Fluxo em duas etapas conforme documentação CWS seção 5.3:
 * 1. POST /prepostagem/v1/prepostagens → criar (retorna ID)
 * 2. POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf → gerar rótulo
 *
 * @param input Dados da pré-postagem
 * @returns Resultado com ID da pré-postagem
 */
export async function criarPrePostagemIndividual(
  input: CreatePrePostagemInput
): Promise<PrePostagemResult> {
  const config = getCorreiosConfig();

  // Converter para formato da API (nova estrutura com remetente/destinatário na raiz)
  const requestBody = buildPrePostagemRequest(input);

  console.log('[CORREIOS_PREPOSTAGEM] Creating individual pre-postagem:', {
    servico: requestBody.codigoServico,
    pesoInformado: requestBody.pesoInformado,                                     // string (gramas)
    codigoFormatoObjetoInformado: requestBody.codigoFormatoObjetoInformado,       // string ("1", "2", "3")
    cienteObjetoNaoProibido: requestBody.cienteObjetoNaoProibido,                 // string ("1")
    endpoint: CORREIOS_ENDPOINTS.prePostagemCriar,
    apiBase: config.apiBase,
    fullUrl: `${config.apiBase}${CORREIOS_ENDPOINTS.prePostagemCriar}`,
  });

  // Log do body completo para debug
  console.log('[CORREIOS_PREPOSTAGEM] Request body:', JSON.stringify(requestBody, null, 2));

  try {
    // Etapa 1: Criar pré-postagem
    const response = await correiosFetch<CorreiosPrePostagemIndividualResponse>(
      CORREIOS_ENDPOINTS.prePostagemCriar,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

    console.log('[CORREIOS_PREPOSTAGEM] Pre-postagem created:', {
      id: response.id,
      codigoObjeto: response.codigoObjeto,
      status: response.status,
      fullResponse: JSON.stringify(response),
    });

    // Verificar se teve erros
    if (response.erros && response.erros.length > 0) {
      return {
        success: false,
        erros: response.erros.map((e) => ({
          codigo: e.codigo,
          mensagem: e.mensagem,
        })),
        bruto: response,
      };
    }

    return {
      success: true,
      idObjeto: response.id,
      codigoRastreio: response.codigoObjeto,
      status: response.status,
      bruto: response,
    };
  } catch (error) {
    console.error('[CORREIOS_PREPOSTAGEM] Failed to create pre-postagem:', error);

    // Capturar detalhes do erro da API dos Correios
    let errorDetails: unknown = null;
    if (error instanceof CorreiosApiError && error.errorDetails) {
      errorDetails = error.errorDetails;
      console.error('[CORREIOS_PREPOSTAGEM] API error details:', JSON.stringify(error.errorDetails, null, 2));
    }

    return {
      success: false,
      erros: [{
        codigo: 'API_ERROR',
        mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
      }],
      bruto: errorDetails,
    };
  }
}

/**
 * Gera rótulo (etiqueta) para uma pré-postagem
 * Etapa 2 do fluxo: POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf
 *
 * @param idPrePostagem ID retornado pela criação da pré-postagem
 * @returns Buffer com o PDF do rótulo
 */
export async function gerarRotulo(
  idPrePostagem: string
): Promise<EtiquetaResult> {
  console.log('[CORREIOS_PREPOSTAGEM] Generating label:', {
    idPrePostagem,
    endpoint: CORREIOS_ENDPOINTS.prePostagemRotulo,
  });

  try {
    const requestBody: CorreiosRotuloRequest = {
      idsPrePostagem: [idPrePostagem],
    };

    const response = await correiosFetch<CorreiosRotuloResponse>(
      CORREIOS_ENDPOINTS.prePostagemRotulo,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

    console.log('[CORREIOS_PREPOSTAGEM] Label response:', {
      id: response.id,
      codigoObjeto: response.codigoObjeto,
      status: response.status,
      hasUrl: !!response.urlRotulo,
    });

    // Se tiver erros, retornar erro
    if (response.erros && response.erros.length > 0) {
      return {
        success: false,
        codigoRastreio: response.codigoObjeto || idPrePostagem,
        erro: response.erros.map((e) => e.mensagem).join(', '),
      };
    }

    // O código de rastreio deve vir na resposta do rótulo
    return {
      success: true,
      codigoRastreio: response.codigoObjeto || idPrePostagem,
      // TODO: Baixar PDF se urlRotulo estiver disponível
      // content: await fetchPdf(response.urlRotulo),
      contentType: 'application/pdf',
      fileName: `rotulo_${response.codigoObjeto || idPrePostagem}.pdf`,
    };
  } catch (error) {
    console.error('[CORREIOS_PREPOSTAGEM] Failed to generate label:', error);

    let errorMsg = 'Erro ao gerar rótulo';
    if (error instanceof CorreiosApiError && error.errorDetails) {
      console.error('[CORREIOS_PREPOSTAGEM] API error details:', JSON.stringify(error.errorDetails, null, 2));
      errorMsg = error.message;
    }

    return {
      success: false,
      codigoRastreio: idPrePostagem,
      erro: errorMsg,
    };
  }
}

/**
 * Interface para resposta da geração assíncrona de rótulo
 */
interface RotuloAsyncResponse {
  idRecibo?: string;
  id?: string;
  status?: string;
  erros?: Array<{ codigo: string; mensagem: string }>;
}

/**
 * Baixa o rótulo (etiqueta) PDF para uma pré-postagem
 * Usa fluxo ASSÍNCRONO em 2 etapas:
 * 1. POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf → retorna idRecibo
 * 2. GET /prepostagem/v1/prepostagens/rotulo/download/assincrono/{idRecibo} → retorna PDF
 *
 * @param idPrePostagem ID da pré-postagem (ex: PRNnhoiSb6SSKvvVJA13MiOA)
 * @returns Buffer com o conteúdo do PDF
 */
export async function baixarRotuloPdf(
  idPrePostagem: string
): Promise<EtiquetaResult> {
  console.log('[CORREIOS_PREPOSTAGEM] Downloading label PDF (async flow):', {
    idPrePostagem,
    step1Endpoint: CORREIOS_ENDPOINTS.prePostagemRotulo,
    step2Endpoint: CORREIOS_ENDPOINTS.prePostagemRotuloDownload,
  });

  try {
    // ETAPA 1: Solicitar geração do rótulo (assíncrono)
    // Parâmetros obrigatórios conforme documentação CWS:
    // - idsPrePostagem: Array de IDs
    // - tipoRotulo: "P" (Papel A4), "R" (Rolo/Térmico ZPL)
    const requestBody = {
      idsPrePostagem: [idPrePostagem],
      tipoRotulo: 'P',  // "P" = Papel A4 (PDF), "R" = Rolo/Térmico (ZPL)
    };

    console.log('[CORREIOS_PREPOSTAGEM] Step 1 - Requesting label generation:', {
      endpoint: CORREIOS_ENDPOINTS.prePostagemRotulo,
      body: requestBody,
    });

    const asyncResponse = await correiosFetch<RotuloAsyncResponse>(
      CORREIOS_ENDPOINTS.prePostagemRotulo,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

    console.log('[CORREIOS_PREPOSTAGEM] Step 1 response:', JSON.stringify(asyncResponse, null, 2));

    // Verificar se teve erros
    if (asyncResponse.erros && asyncResponse.erros.length > 0) {
      return {
        success: false,
        codigoRastreio: idPrePostagem,
        erro: asyncResponse.erros.map((e) => e.mensagem).join(', '),
      };
    }

    // Obter ID do recibo
    const idRecibo = asyncResponse.idRecibo || asyncResponse.id;
    if (!idRecibo) {
      return {
        success: false,
        codigoRastreio: idPrePostagem,
        erro: 'API não retornou idRecibo para download do PDF',
      };
    }

    console.log('[CORREIOS_PREPOSTAGEM] Step 1 success, got idRecibo:', { idRecibo });

    // Aguardar um momento para processamento (o Correios pode precisar de tempo)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // ETAPA 2: Baixar o PDF usando o idRecibo
    // A resposta vem em JSON com o PDF em base64
    console.log('[CORREIOS_PREPOSTAGEM] Step 2 - Downloading PDF:', {
      endpoint: `${CORREIOS_ENDPOINTS.prePostagemRotuloDownload}/${idRecibo}`,
    });

    const downloadResponse = await correiosFetch<{
      rotulo?: string;       // PDF em base64
      pdf?: string;          // Alternativa: PDF em base64
      base64?: string;       // Alternativa: PDF em base64
      status?: string;
      erros?: Array<{ codigo: string; mensagem: string }>;
    }>(
      `${CORREIOS_ENDPOINTS.prePostagemRotuloDownload}/${idRecibo}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    console.log('[CORREIOS_PREPOSTAGEM] Step 2 - Download response:', {
      idPrePostagem,
      idRecibo,
      hasRotulo: !!downloadResponse.rotulo,
      hasPdf: !!downloadResponse.pdf,
      hasBase64: !!downloadResponse.base64,
      status: downloadResponse.status,
      responseKeys: Object.keys(downloadResponse),
    });

    // Verificar se teve erros
    if (downloadResponse.erros && downloadResponse.erros.length > 0) {
      return {
        success: false,
        codigoRastreio: idPrePostagem,
        erro: downloadResponse.erros.map((e) => e.mensagem).join(', '),
      };
    }

    // O PDF pode vir em diferentes campos (rotulo, pdf, ou base64)
    const pdfBase64 = downloadResponse.rotulo || downloadResponse.pdf || downloadResponse.base64;

    if (pdfBase64) {
      // Converter base64 para Buffer
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      console.log('[CORREIOS_PREPOSTAGEM] Step 2 - PDF decoded:', {
        idPrePostagem,
        size: pdfBuffer.length,
      });

      return {
        success: true,
        codigoRastreio: idPrePostagem,
        content: pdfBuffer,
        contentType: 'application/pdf',
        fileName: `rotulo_${idPrePostagem}.pdf`,
      };
    }

    // Se não encontrou o PDF no formato esperado, logar a resposta completa
    console.error('[CORREIOS_PREPOSTAGEM] Step 2 - PDF not found in response:', JSON.stringify(downloadResponse, null, 2));

    return {
      success: false,
      codigoRastreio: idPrePostagem,
      erro: 'PDF não encontrado na resposta da API (etapa 2)',
    };
  } catch (error) {
    console.error('[CORREIOS_PREPOSTAGEM] Failed to download label PDF:', error);

    let errorMsg = 'Erro ao baixar rótulo PDF';
    if (error instanceof CorreiosApiError && error.errorDetails) {
      console.error('[CORREIOS_PREPOSTAGEM] API error details:', JSON.stringify(error.errorDetails, null, 2));
      errorMsg = error.message;
    }

    return {
      success: false,
      codigoRastreio: idPrePostagem,
      erro: errorMsg,
    };
  }
}

// ============================================================================
// Criação de Pré-Postagem em Lote (mantido para compatibilidade)
// ============================================================================

/**
 * Cria um lote de pré-postagem com um ou mais objetos
 * NOTA: Este método usa o fluxo individual internamente
 *
 * @param objetos Array de objetos para pré-postagem
 * @returns Resultado com IDs e códigos de rastreio
 */
export async function criarLotePrePostagem(
  objetos: CreatePrePostagemInput[]
): Promise<PrePostagemResult[]> {
  if (objetos.length === 0) {
    throw new CorreiosValidationError('Nenhum objeto informado para pré-postagem');
  }

  console.log('[CORREIOS_PREPOSTAGEM] Creating batch of', objetos.length, 'pre-postagens');

  // Processar cada objeto individualmente
  const results: PrePostagemResult[] = [];

  for (const input of objetos) {
    const result = await criarPrePostagemIndividual(input);
    results.push(result);

    // Se criou com sucesso e temos ID, tentar gerar rótulo
    if (result.success && result.idObjeto) {
      const rotuloResult = await gerarRotulo(result.idObjeto);
      if (rotuloResult.success && rotuloResult.codigoRastreio) {
        result.codigoRastreio = rotuloResult.codigoRastreio;
      }
    }
  }

  return results;
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
// Consulta de Pré-Postagem
// ============================================================================

/**
 * Interface para resultado de busca de pré-postagem
 */
export interface BuscaPrePostagemResult {
  success: boolean;
  idPrePostagem?: string;
  codigoRastreio?: string;
  status?: string;
  erro?: string;
}

/**
 * Busca uma pré-postagem pelo código de rastreio
 * Usa o endpoint GET /v2/prepostagens com filtro por codigoObjeto
 *
 * @param codigoRastreio Código de rastreio (ex: AN312817735BR)
 * @returns ID da pré-postagem para download do rótulo
 */
export async function buscarPrePostagemPorRastreio(
  codigoRastreio: string
): Promise<BuscaPrePostagemResult> {
  console.log('[CORREIOS_PREPOSTAGEM] Searching for pre-postagem by tracking code:', {
    codigoRastreio,
  });

  try {
    // Tentar buscar via endpoint de consulta
    // O endpoint /prepostagem/v2/prepostagens aceita parâmetros de filtro
    const response = await correiosFetch<{
      itens?: Array<{
        id: string;
        codigoObjeto: string;
        statusAtual?: number;
        descStatusAtual?: string;
      }>;
      prepostagens?: Array<{
        id: string;
        codigoObjeto: string;
        status?: string;
      }>;
      content?: Array<{
        id: string;
        codigoObjeto: string;
        status?: string;
      }>;
    }>(
      `${CORREIOS_ENDPOINTS.prePostagemConsulta}?codigoObjeto=${codigoRastreio}`,
      {
        method: 'GET',
      }
    );

    console.log('[CORREIOS_PREPOSTAGEM] Search response:', JSON.stringify(response, null, 2));

    // A resposta pode vir em diferentes formatos (itens é o formato v2)
    const prepostagens = response.itens || response.prepostagens || response.content || [];

    if (prepostagens.length > 0) {
      const found = prepostagens[0];
      return {
        success: true,
        idPrePostagem: found.id,
        codigoRastreio: found.codigoObjeto,
        status: found.descStatusAtual || found.status,
      };
    }

    return {
      success: false,
      erro: `Nenhuma pré-postagem encontrada para o código ${codigoRastreio}`,
    };
  } catch (error) {
    console.error('[CORREIOS_PREPOSTAGEM] Search failed:', error);

    let errorMsg = 'Erro ao buscar pré-postagem';
    if (error instanceof CorreiosApiError) {
      errorMsg = error.message;
      if (error.errorDetails) {
        console.error('[CORREIOS_PREPOSTAGEM] API error details:', JSON.stringify(error.errorDetails, null, 2));
      }
    }

    return {
      success: false,
      erro: errorMsg,
    };
  }
}

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
