/**
 * Tipos para integração com APIs REST dos Correios (CWS)
 *
 * Referência: Manual de Integração APIs Correios
 * https://www.correios.com.br/atendimento/developers
 */

// ============================================================================
// Configuração
// ============================================================================

export interface CorreiosConfig {
  environment: 'sandbox' | 'production';
  apiBase: string;
  /** Usuário CWS (modo legado) */
  usuario: string;
  /** Senha CWS (modo legado) */
  senha: string;
  /** Cartão de Postagem */
  cartaoPostagem: string;
  /** API Key do CWS (nova autenticação - formato: cws-ch1_...) */
  apiKey?: string;
  contrato?: string;
  dr?: number;
}

export interface CorreiosServiceConfig {
  codigoServico: string;    // Código do serviço na API (ex: "03220" para SEDEX)
  coProduto: string;        // Código do produto (geralmente igual ao codigoServico)
  nomeExibicao: string;     // Nome amigável para exibição (ex: "SEDEX")
  habilitado: boolean;
  ordemExibicao: number;
}

// ============================================================================
// Token (Autenticação)
// ============================================================================

export interface CorreiosTokenResponse {
  ambiente: string;
  id: string;
  ip: string;
  perfil: string;
  cnpj: string;
  emissao: string;
  expiraEm: string;
  zoneOffset: string;
  token: string;
  cartaoPostagem?: {
    numero: string;
    contrato: string;
    dr: number;
    api: Array<{
      id: number;
      descricao: string;
    }>;
    servicos?: Array<{
      codigo: string;
      descricao: string;
    }>;
  };
}

export interface TokenCache {
  token: string;
  expiraEm: Date;
  fetchedAt: Date;
}

// ============================================================================
// API Preço
// ============================================================================

export interface CorreiosPrecoRequest {
  idLote?: string;
  parametrosProduto: Array<{
    coProduto: string;
    nuRequisicao?: string;
    cepOrigem: string;
    cepDestino: string;
    psObjeto: number;        // Peso em gramas (int)
    tpObjeto: number;        // Tipo de objeto (1=Envelope, 2=Caixa/Pacote, 3=Rolo/Prisma)
    comprimento?: number;    // cm (int)
    largura?: number;        // cm (int)
    altura?: number;         // cm (int)
    diametro?: number;       // cm (int)
    servicosAdicionais?: Array<{
      coServAdicional: string;
      vlDeclarado?: number;  // Valor declarado em reais (decimal)
    }>;
    vlDeclarado?: number;
  }>;
}

export interface CorreiosPrecoResponse {
  idLote?: string;
  parametrosProduto: Array<{
    coProduto: string;
    nuRequisicao?: string;
    pcBase?: string;         // Preço base (formato "XX,XX")
    pcBaseGeral?: string;
    peAdValorem?: string;
    pcFaixa?: string;
    pcFaixaVariacao?: string;
    pcProduto?: string;
    pcTotalServicosAdicionais?: string;
    pcFinal?: string;        // Preço final (formato "XX,XX")
    txErro?: Array<{
      cdErro: string;
      dsErro: string;
    }>;
    servicoAdicional?: Array<{
      coServAdicional: string;
      tpServAdicional: string;
      pcServicoAdicional?: string;
    }>;
  }>;
}

// ============================================================================
// API Prazo
// ============================================================================

export interface CorreiosPrazoRequest {
  idLote?: string;
  parametrosPrazo: Array<{
    coProduto: string;
    nuRequisicao?: string;
    cepOrigem: string;
    cepDestino: string;
    dtEvento?: string;       // Data do evento (formato YYYY-MM-DD)
  }>;
}

export interface CorreiosPrazoResponse {
  idLote?: string;
  parametrosPrazo: Array<{
    coProduto: string;
    nuRequisicao?: string;
    cepOrigem?: string;
    cepDestino?: string;
    prazoEntrega?: number;     // Dias úteis
    dataMaxima?: string;       // Data máxima (formato DD/MM/YYYY)
    entregaDomiciliar?: string; // "S" ou "N"
    entregaSabado?: string;     // "S" ou "N"
    txErro?: Array<{
      cdErro: string;
      dsErro: string;
    }>;
  }>;
}

// ============================================================================
// Tipos Internos (Multienvio)
// ============================================================================

export interface CorreiosPrecoPrazoInput {
  cepOrigem: string;
  cepDestino: string;
  pesoGramas: number;
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
  servicosAdicionais?: string[];  // ex.: ["019", "001"]
  valorDeclarado?: number;        // em reais
}

export interface CorreiosPrecoOutput {
  codigoServicoCorreios: string;
  precoTotal: number;           // em reais
  precoBase?: number;
  precoServicosAdicionais?: number;
  erros?: Array<{ codigo: string; mensagem: string }>;
  bruto: unknown;               // resposta completa dos Correios
}

export interface CorreiosPrazoOutput {
  codigoServicoCorreios: string;
  prazoDias: number;
  dataMaxima?: string;
  entregaDomiciliar: boolean;
  entregaSabado: boolean;
  erros?: Array<{ codigo: string; mensagem: string }>;
  bruto: unknown;
}

export interface CorreiosCotacaoCompleta {
  codigoServicoCorreios: string;
  nomeServico: string;
  precoTotal: number;
  prazoDias: number;
  entregaDomiciliar: boolean;
  entregaSabado: boolean;
  erros?: Array<{ codigo: string; mensagem: string }>;
  brutoPreco: unknown;
  brutoPrazo: unknown;
}

// ============================================================================
// API Pré-Postagem (PPN)
// ============================================================================

export interface CorreiosDestinatario {
  nome: string;
  cpfCnpj?: string;
  telefone?: string;
  celular?: string;
  email?: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade: string;
    uf: string;
  };
}

export interface CorreiosRemetente {
  nome: string;
  cpfCnpj?: string;
  telefone?: string;
  celular?: string;
  email?: string;
  endereco: {
    cep: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
}

/**
 * Objeto dentro de uma pré-postagem (item de envio)
 * Conforme documentação CWS seção 5.3
 */
export interface CorreiosPrePostagemObjeto {
  codigoServico: string;
  peso: number;                // gramas
  formatoObjeto: string;       // "1"=Envelope, "2"=Caixa/Pacote, "3"=Rolo/Prisma (OBRIGATÓRIO - string)
  objetosProibidos: string;    // "S" ou "N" (OBRIGATÓRIO)
  dimensao?: {
    altura?: number;           // cm
    largura?: number;          // cm
    comprimento?: number;      // cm
    diametro?: number;         // cm
  };
  valorDeclarado?: number;     // reais
  descricaoObjeto?: string;
  listaServicoAdicional?: Array<{
    codigoServicoAdicional: string;
    valorDeclarado?: number;
  }>;
  // Declaração de Conteúdo (obrigatório se não tiver NF-e)
  itensDeclaracaoConteudo?: Array<{
    conteudo: string;          // Descrição do item
    quantidade: number;
    valor: number;             // Valor unitário em reais
  }>;
  // NF-e (se aplicável)
  listaNotaFiscal?: Array<{
    chaveNFe: string;
  }>;
}

/**
 * Item da Declaração de Conteúdo
 * Conforme documentação oficial CWS - todos os campos são STRINGS
 */
export interface CorreiosItemDeclaracaoConteudo {
  conteudo: string;                   // Descrição do item (obrigatório)
  quantidade: string;                 // Quantidade como string (obrigatório)
  valor: string;                      // Valor unitário em reais como string (obrigatório)
}

/**
 * Request body para criar pré-postagem
 * Estrutura FLAT conforme documentação oficial CWS
 * IMPORTANTE: Não usar wrapper "objeto" - todos os campos ficam na raiz!
 *
 * Campos com nomes corretos da API:
 * - pesoInformado (não "peso")
 * - codigoFormatoObjetoInformado (não "formatoObjeto")
 * - cienteObjetoNaoProibido (não "objetosProibidos")
 * - alturaInformada, larguraInformada, comprimentoInformado (não "dimensao")
 */
export interface CorreiosPrePostagemRequest {
  // Serviço
  codigoServico: string;                    // Código do serviço (obrigatório) - ex: "03298"

  // Partes
  remetente: CorreiosRemetente;             // Dados do remetente (obrigatório)
  destinatario: CorreiosDestinatario;       // Dados do destinatário (obrigatório)

  // Peso e Dimensões - TODOS COMO STRING e TOP-LEVEL (não dentro de objeto!)
  pesoInformado: string;                    // Peso em gramas como string (obrigatório) - ex: "500"
  codigoFormatoObjetoInformado: string;     // "1"=Envelope, "2"=Caixa, "3"=Rolo (obrigatório)
  alturaInformada?: string;                 // Altura em cm como string
  larguraInformada?: string;                // Largura em cm como string
  comprimentoInformado?: string;            // Comprimento em cm como string
  diametroInformado?: string;               // Diâmetro em cm como string (para rolos)

  // Flag de objetos proibidos - OBRIGATÓRIO
  cienteObjetoNaoProibido: string;          // "1" = ciente que não contém objetos proibidos

  // Declaração de Conteúdo (obrigatório se não tiver NF-e)
  itensDeclaracaoConteudo?: CorreiosItemDeclaracaoConteudo[];

  // Valor declarado (opcional)
  valorDeclarado?: string;                  // Valor em reais como string

  // NF-e (se aplicável - alternativa à declaração de conteúdo)
  listaNotaFiscal?: Array<{
    chaveNFe: string;
  }>;

  // Campos opcionais adicionais
  modalidadePagamento?: string;             // "1"=À vista, "2"=À faturar
  numeroCartaoPostagem?: string;            // Número do cartão de postagem
  logisticaReversa?: string;                // "S" ou "N"
  servicosAdicionais?: Array<{
    codigoServicoAdicional: string;
    valorDeclarado?: string;
  }>;
}

export interface CorreiosPrePostagemLoteRequest {
  idCorreios?: string;
  codigoRemetente?: string;
  objetosPostais: CorreiosPrePostagemObjeto[];
}

export interface CorreiosPrePostagemLoteResponse {
  idLote: string;
  status?: string;
  dataCriacao?: string;
  objetosPostais?: Array<{
    idObjeto?: string;
    codigoObjeto?: string;    // Código de rastreio (SRO)
    status?: string;
    erros?: Array<{
      codigo: string;
      mensagem: string;
    }>;
  }>;
  erros?: Array<{
    codigo: string;
    mensagem: string;
  }>;
}

// Pré-Postagem Individual (v1) - Fluxo em duas etapas
export interface CorreiosPrePostagemIndividualResponse {
  id: string;                 // ID da pré-postagem (usado para gerar rótulo)
  codigoObjeto?: string;      // Código de rastreio (pode vir aqui ou no rótulo)
  status?: string;
  dataCriacao?: string;
  erros?: Array<{
    codigo: string;
    mensagem: string;
  }>;
}

export interface CorreiosRotuloRequest {
  idsPrePostagem: string[];   // Array de IDs de pré-postagem
}

export interface CorreiosRotuloResponse {
  // Pode retornar PDF binário ou objeto com dados
  id?: string;
  codigoObjeto?: string;      // Código de rastreio (SRO)
  status?: string;
  urlRotulo?: string;         // URL para download do rótulo
  erros?: Array<{
    codigo: string;
    mensagem: string;
  }>;
}

export interface CorreiosEtiquetaResponse {
  content: Buffer;
  contentType: string;  // 'application/pdf' ou 'application/zpl'
  fileName?: string;
}

// ============================================================================
// API Rastro
// ============================================================================

export interface CorreiosRastroEvento {
  codigo: string;
  tipo: string;
  descricao: string;
  dtHrCriado: string;
  unidade?: {
    tipo?: string;
    endereco?: {
      cidade?: string;
      uf?: string;
    };
  };
  unidadeDestino?: {
    tipo?: string;
    endereco?: {
      cidade?: string;
      uf?: string;
    };
  };
}

export interface CorreiosRastroObjeto {
  codObjeto: string;
  tipoPostal?: {
    sigla?: string;
    descricao?: string;
    categoria?: string;
  };
  eventos?: CorreiosRastroEvento[];
  mensagem?: string;
}

export interface CorreiosRastroResponse {
  objetos: CorreiosRastroObjeto[];
  quantidade?: number;
  resultado?: string;
  versao?: string;
}

// ============================================================================
// API CEP
// ============================================================================

export interface CorreiosCepResponse {
  cep: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
}

// ============================================================================
// Erros
// ============================================================================

export class CorreiosApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
    public readonly errorDetails?: unknown
  ) {
    super(message);
    this.name = 'CorreiosApiError';
  }
}

export class CorreiosAuthError extends CorreiosApiError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode, 'AUTH_ERROR');
    this.name = 'CorreiosAuthError';
  }
}

export class CorreiosValidationError extends CorreiosApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'CorreiosValidationError';
  }
}

// ============================================================================
// Multi-Volume (Package e Shipment)
// ============================================================================

/**
 * Dados de um volume para atualização do Package no banco
 * Usado após criar pré-postagem
 */
export interface CorreiosPackageUpdate {
  packageNumber: number;        // Número do volume (1, 2, 3...)
  carrierTrackingCode: string;  // Código de rastreio (ex: AB123456789BR)
  carrierPrePostageId: string;  // ID da pré-postagem (ex: PRNnhoiSb6SSKvvVJA13MiOA)
  carrierQuotePrice?: number;   // Preço do frete deste volume
}

/**
 * Metadados resumidos do Correios armazenados em Shipment.carrierMetadata
 * Dados detalhados ficam em cada Package
 */
export interface CorreiosShipmentMetadata {
  carrier: 'correios';
  serviceCode: string;          // Código do serviço (ex: 03298)
  serviceName: string;          // Nome do serviço (ex: PAC)
  isMultiVolume: boolean;       // Se tem mais de 1 volume
  totalVolumes: number;         // Total de volumes
  totalPrice: number;           // Preço total do frete (soma de todos volumes)
}

/**
 * Input para cotação por volume
 */
export interface CorreiosVolumeQuoteInput {
  packageNumber: number;
  weight: number;               // kg
  width: number;                // cm
  height: number;               // cm
  length: number;               // cm
}

/**
 * Resultado de cotação por volume
 */
export interface CorreiosVolumeQuoteResult {
  packageNumber: number;
  serviceCode: string;
  serviceName: string;
  price: number;
  deliveryDays: number;
  error?: string;
}

/**
 * Resultado consolidado de cotação multi-volume
 */
export interface CorreiosMultiVolumeQuoteResult {
  serviceCode: string;
  serviceName: string;
  totalPrice: number;           // Soma dos preços de todos os volumes
  deliveryDays: number;         // Prazo (igual para todos os volumes)
  volumeResults: CorreiosVolumeQuoteResult[];
  hasErrors: boolean;
}
