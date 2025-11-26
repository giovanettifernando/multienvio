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

export interface CorreiosContractConfig {
  cartaoPostagem: string;
  contrato: string;
  dr: number;
  servicos: CorreiosServiceConfig[];
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
// Tipos Internos (Envio Legal)
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

export interface CorreiosPrePostagemObjeto {
  codigoServico: string;
  pesoInformado: number;       // gramas
  alturaInformada?: number;    // cm
  larguraInformada?: number;   // cm
  comprimentoInformado?: number; // cm
  diametroInformado?: number;  // cm
  destinatario: CorreiosDestinatario;
  remetente: CorreiosRemetente;
  valorDeclarado?: number;     // reais
  conteudo?: string;
  descricaoObjeto?: string;
  servicosAdicionais?: Array<{
    codigoServicoAdicional: string;
    valorDeclarado?: number;
  }>;
  // NF-e (se aplicável)
  notasFiscais?: Array<{
    chaveNFe: string;
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

export interface CorreiosReciboResponse {
  idRecibo: string;
  status: string;
  dataCriacao?: string;
  idLote?: string;
  objetos?: Array<{
    codigoObjeto: string;
    status?: string;
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
