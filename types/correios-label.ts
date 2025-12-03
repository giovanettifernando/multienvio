/**
 * Tipos para etiquetas de envio Correios
 * Baseado no Guia de Endereçamento Correios
 * Formato: 84.7 x 101.6 mm (6 etiquetas por folha)
 */

// ========================
// ENDEREÇOS
// ========================

export interface LabelAddress {
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone?: string;
  email?: string;
  documento?: string; // CPF/CNPJ
}

// ========================
// SERVIÇOS CORREIOS
// ========================

/** Códigos de serviço Correios com seus símbolos de encaminhamento */
export type CorreiosServiceCode =
  | "04014" // SEDEX
  | "04510" // PAC
  | "04782" // SEDEX 12
  | "04790" // SEDEX 10
  | "04804" // SEDEX Hoje
  | "03298" // PAC Mini Envios
  | "03220" // SEDEX Mini Envios
  | "40010" // SEDEX (antigo)
  | "41106" // PAC (antigo)
  | string; // Outros serviços

/** Nomes dos serviços para exibição */
export type CorreiosServiceName =
  | "SEDEX"
  | "PAC"
  | "SEDEX 10"
  | "SEDEX 12"
  | "SEDEX Hoje"
  | "Mini Envios PAC"
  | "Mini Envios SEDEX"
  | string;

/** Símbolos de encaminhamento (logotipos) */
export type RoutingSymbol =
  | "SEDEX"       // Símbolo vermelho padrão
  | "PAC"         // Símbolo azul
  | "SEDEX_HOJE"  // SEDEX Hoje
  | "SEDEX_10"    // SEDEX 10
  | "SEDEX_12"    // SEDEX 12
  | "MINI_ENVIOS" // Mini Envios
  | "GENERIC";    // Fallback genérico

// ========================
// SERVIÇOS ADICIONAIS
// ========================

export interface AdditionalServices {
  /** Aviso de Recebimento (AR) */
  ar?: boolean;
  /** Mão Própria (MP) */
  mp?: boolean;
  /** Valor Declarado (VD) - valor em centavos */
  vd?: number;
  /** Entrega Domiciliar (DD) - para Mini Envios */
  dd?: boolean;
}

// ========================
// VOLUME/PACOTE
// ========================

export interface LabelVolume {
  /** Índice do volume (1-based) */
  index: number;
  /** Total de volumes no envio */
  total: number;
  /** Peso real em kg */
  pesoKg: number;
  /** Peso cubado em kg */
  pesoCubadoKg?: number;
  /** Dimensões em cm */
  dimensoes: {
    comprimento: number;
    largura: number;
    altura: number;
  };
}

// ========================
// DATA MATRIX (2D)
// ========================

/**
 * Estrutura do Data Matrix Correios (160 caracteres)
 *
 * Posições fixas:
 * - 1-8: CEP destino
 * - 9-16: CEP origem
 * - 17: Dígito validador CEP destino
 * - 18-30: Código de rastreamento (13 chars)
 * - 31-38: Serviços adicionais (ex: "ARMPVDDD")
 * - 39-41: Código cartão postagem
 * - 42-46: Código serviço
 * - 47-48: Info agrupamento "00"
 * - 49-50: Número volume
 * - 51-55: Peso real (gramas, 5 dígitos)
 * - 56-56: Filler " "
 * - 57-68: Telefone destinatário
 * - 69-73: Latitude (5 chars)
 * - 74-78: Longitude (5 chars)
 * - 79: Pipe "|"
 * - 80-108: Complemento destino (30 chars)
 * - 109: Pipe "|"
 * - 110-149: Valor declarado (40 chars) ou zeros
 * - 150: Pipe "|"
 * - 151-160: Número NF-e (10 chars) ou zeros
 */
export interface DataMatrixStructure {
  cepDestino: string;      // 8 chars
  cepOrigem: string;       // 8 chars
  dvCepDestino: string;    // 1 char (dígito validador)
  codigoRastreamento: string; // 13 chars
  servicosAdicionais: string; // 8 chars
  codigoCartaoPostagem: string; // 3 chars
  codigoServico: string;   // 5 chars
  infoAgrupamento: string; // 2 chars "00"
  numeroVolume: string;    // 2 chars
  pesoGramas: string;      // 5 chars
  telefoneDestinatario: string; // 12 chars
  latitude: string;        // 5 chars
  longitude: string;       // 5 chars
  complementoDestino: string; // 30 chars
  valorDeclarado: string;  // 40 chars
  numeroNfe: string;       // 10 chars
}

// ========================
// DADOS COMPLETOS DA ETIQUETA
// ========================

export interface CorreiosLabelData {
  /** Código de rastreamento (13 caracteres, ex: SS123456789BR) */
  trackingCode: string;

  /** Código do serviço Correios */
  serviceCode: CorreiosServiceCode;

  /** Nome do serviço para exibição */
  serviceName: CorreiosServiceName;

  /** Símbolo de encaminhamento a ser usado */
  routingSymbol: RoutingSymbol;

  /** Endereço do remetente */
  sender: LabelAddress;

  /** Endereço do destinatário */
  recipient: LabelAddress;

  /** Informações do volume */
  volume: LabelVolume;

  /** Serviços adicionais */
  additionalServices: AdditionalServices;

  /** Código do cartão de postagem (3 dígitos) */
  postingCardCode: string;

  /** Número da NF-e (se houver) */
  nfeNumber?: string;

  /** Chave da NF-e (44 caracteres) */
  nfeKey?: string;

  /** Data de postagem */
  postingDate?: Date;

  /** Contrato Correios */
  contractNumber?: string;

  /** DR (Diretoria Regional) de origem */
  drOrigem?: string;

  /** Observações para impressão na etiqueta */
  observation?: string;
}

// ========================
// COMPONENTE PROPS
// ========================

export interface EtiquetaCorreiosProps {
  data: CorreiosLabelData;
  /** Mostrar linha de corte pontilhada */
  showCutLine?: boolean;
  /** Escala de impressão (1 = 100%) */
  scale?: number;
}

// ========================
// ETIQUETA GENÉRICA
// ========================

export interface GenericLabelData {
  trackingCode?: string;
  carrier: string;
  serviceName: string;
  sender: LabelAddress;
  recipient: LabelAddress;
  volume: LabelVolume;
  additionalServices?: AdditionalServices;
  postingDate?: Date;
}

export interface EtiquetaGenericaProps {
  data: GenericLabelData;
  showCutLine?: boolean;
  scale?: number;
}

// ========================
// MAPEAMENTOS
// ========================

/** Mapeamento de código de serviço para símbolo de encaminhamento */
export const SERVICE_TO_SYMBOL: Record<string, RoutingSymbol> = {
  "04014": "SEDEX",
  "40010": "SEDEX",
  "04510": "PAC",
  "41106": "PAC",
  "04782": "SEDEX_12",
  "04790": "SEDEX_10",
  "04804": "SEDEX_HOJE",
  "03298": "MINI_ENVIOS",
  "03220": "MINI_ENVIOS",
};

/** Cores dos serviços */
export const SERVICE_COLORS: Record<RoutingSymbol, { bg: string; text: string }> = {
  SEDEX: { bg: "#E30613", text: "#FFFFFF" },
  PAC: { bg: "#004B87", text: "#FFFFFF" },
  SEDEX_HOJE: { bg: "#E30613", text: "#FFFFFF" },
  SEDEX_10: { bg: "#E30613", text: "#FFFFFF" },
  SEDEX_12: { bg: "#E30613", text: "#FFFFFF" },
  MINI_ENVIOS: { bg: "#FFD100", text: "#000000" },
  GENERIC: { bg: "#666666", text: "#FFFFFF" },
};

/** Dimensões da etiqueta em mm */
export const LABEL_DIMENSIONS = {
  width: 84.7,
  height: 101.6,
  // Margens internas
  padding: 2,
  // Área do Data Matrix
  dataMatrix: {
    size: 25, // 25x25mm
  },
  // Código de barras de rastreamento
  trackingBarcode: {
    width: 90,
    height: 15,
  },
  // Código de barras do CEP
  cepBarcode: {
    width: 40,
    height: 15,
  },
} as const;

/** Fontes usadas na etiqueta (Arial) */
export const LABEL_FONTS = {
  destinatarioNome: { size: 11, weight: "bold" },
  destinatarioEndereco: { size: 10, weight: "normal" },
  destinatarioCep: { size: 11, weight: "bold" },
  remetenteNome: { size: 8, weight: "bold" },
  remetenteEndereco: { size: 8, weight: "normal" },
  rastreamento: { size: 10, weight: "bold" },
  servicos: { size: 8, weight: "normal" },
} as const;
