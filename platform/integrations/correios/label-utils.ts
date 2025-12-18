/**
 * Utilitários para geração de etiquetas Correios
 */

import type {
  CorreiosLabelData,
  DataMatrixStructure,
  RoutingSymbol,
  SERVICE_TO_SYMBOL,
} from '@/shared/types/correios-label';

/**
 * Calcula o dígito validador do CEP
 * Algoritmo: soma dos 8 dígitos, subtrai do próximo múltiplo de 10
 * Se resultado = 10, dígito = 0
 *
 * @example
 * calculateCepValidatorDigit("01310100") // returns "2"
 */
export function calculateCepValidatorDigit(cep: string): string {
  // Remove caracteres não numéricos
  const cleanCep = cep.replace(/\D/g, "");

  if (cleanCep.length !== 8) {
    throw new Error(`CEP inválido: ${cep}. Deve ter 8 dígitos.`);
  }

  // Soma dos 8 dígitos
  const sum = cleanCep.split("").reduce((acc, digit) => acc + parseInt(digit, 10), 0);

  // Próximo múltiplo de 10
  const nextMultipleOf10 = Math.ceil(sum / 10) * 10;

  // Dígito validador
  let validatorDigit = nextMultipleOf10 - sum;

  // Se o resultado for 10, o dígito é 0
  if (validatorDigit === 10) {
    validatorDigit = 0;
  }

  return validatorDigit.toString();
}

/**
 * Formata string com padding à direita (para campos de texto)
 */
export function padRight(str: string, length: number, char = " "): string {
  return str.substring(0, length).padEnd(length, char);
}

/**
 * Formata string com padding à esquerda (para campos numéricos)
 */
export function padLeft(str: string, length: number, char = "0"): string {
  return str.substring(0, length).padStart(length, char);
}

/**
 * Formata serviços adicionais para o Data Matrix (8 caracteres)
 * Ordem: AR MP VD DD (cada um com 2 chars)
 */
export function formatAdditionalServices(
  ar: boolean = false,
  mp: boolean = false,
  vd: boolean = false,
  dd: boolean = false
): string {
  return (
    (ar ? "AR" : "  ") +
    (mp ? "MP" : "  ") +
    (vd ? "VD" : "  ") +
    (dd ? "DD" : "  ")
  );
}

/**
 * Gera a string de 160 caracteres para o Data Matrix
 *
 * Estrutura:
 * - Pos 1-8: CEP destino
 * - Pos 9-16: CEP origem
 * - Pos 17: Dígito validador CEP destino
 * - Pos 18-30: Código de rastreamento (13 chars)
 * - Pos 31-38: Serviços adicionais
 * - Pos 39-41: Código cartão postagem (3 chars)
 * - Pos 42-46: Código serviço (5 chars)
 * - Pos 47-48: Info agrupamento "00"
 * - Pos 49-50: Número volume (2 chars)
 * - Pos 51-55: Peso em gramas (5 chars)
 * - Pos 56: Filler " "
 * - Pos 57-68: Telefone destinatário (12 chars)
 * - Pos 69-73: Latitude (5 chars)
 * - Pos 74-78: Longitude (5 chars)
 * - Pos 79: Pipe "|"
 * - Pos 80-108: Complemento destino (30 chars com pipe no início)
 * - Pos 109: Já incluído no complemento
 * - Pos 110-149: Valor declarado (40 chars)
 * - Pos 150: Pipe "|"
 * - Pos 151-160: Número NF-e (10 chars)
 */
export function generateDataMatrixString(data: CorreiosLabelData): string {
  const {
    trackingCode,
    serviceCode,
    sender,
    recipient,
    volume,
    additionalServices,
    postingCardCode,
    nfeNumber,
  } = data;

  // Limpa CEPs
  const cepDestino = recipient.cep.replace(/\D/g, "");
  const cepOrigem = sender.cep.replace(/\D/g, "");

  // Dígito validador do CEP destino
  const dvCepDestino = calculateCepValidatorDigit(cepDestino);

  // Código de rastreamento (13 caracteres)
  const tracking = padRight(trackingCode || "", 13);

  // Serviços adicionais (8 caracteres)
  const servicos = formatAdditionalServices(
    additionalServices?.ar,
    additionalServices?.mp,
    !!additionalServices?.vd,
    additionalServices?.dd
  );

  // Código cartão postagem (3 caracteres)
  const cartao = padLeft(postingCardCode || "000", 3);

  // Código do serviço (5 caracteres)
  const servico = padLeft(serviceCode || "00000", 5);

  // Info agrupamento (sempre "00")
  const agrupamento = "00";

  // Número do volume (2 caracteres)
  const numVolume = padLeft(volume.index.toString(), 2);

  // Peso em gramas (5 caracteres)
  const pesoGramas = padLeft(Math.round(volume.pesoKg * 1000).toString(), 5);

  // Filler
  const filler = " ";

  // Telefone destinatário (12 caracteres)
  const telefone = padRight((recipient.telefone || "").replace(/\D/g, ""), 12);

  // Latitude e longitude (5 caracteres cada) - geralmente não usado
  const latitude = padRight("", 5);
  const longitude = padRight("", 5);

  // Pipe separador
  const pipe = "|";

  // Complemento destino (30 caracteres, incluindo pipe inicial)
  const complemento = padRight(recipient.complemento || "", 29);

  // Valor declarado (40 caracteres)
  // Formato: valor em centavos com zeros à esquerda
  const valorDeclaradoCentavos = additionalServices?.vd
    ? padLeft(additionalServices.vd.toString(), 40)
    : padLeft("", 40, "0");

  // Número NF-e (10 caracteres)
  const nfe = padLeft(nfeNumber || "", 10, "0");

  // Monta a string completa (160 caracteres)
  const dataMatrixString =
    cepDestino +           // 1-8 (8)
    cepOrigem +            // 9-16 (8)
    dvCepDestino +         // 17 (1)
    tracking +             // 18-30 (13)
    servicos +             // 31-38 (8)
    cartao +               // 39-41 (3)
    servico +              // 42-46 (5)
    agrupamento +          // 47-48 (2)
    numVolume +            // 49-50 (2)
    pesoGramas +           // 51-55 (5)
    filler +               // 56 (1)
    telefone +             // 57-68 (12)
    latitude +             // 69-73 (5)
    longitude +            // 74-78 (5)
    pipe +                 // 79 (1)
    complemento +          // 80-108 (29)
    pipe +                 // 109 (1)
    valorDeclaradoCentavos + // 110-149 (40)
    pipe +                 // 150 (1)
    nfe;                   // 151-160 (10)

  // Validação do tamanho
  if (dataMatrixString.length !== 160) {
    console.warn(
      `Data Matrix string tem ${dataMatrixString.length} caracteres, esperado 160`
    );
  }

  return dataMatrixString;
}

/**
 * Decodifica uma string Data Matrix em sua estrutura
 */
export function parseDataMatrixString(str: string): DataMatrixStructure {
  if (str.length !== 160) {
    throw new Error(`String Data Matrix inválida: ${str.length} caracteres, esperado 160`);
  }

  return {
    cepDestino: str.substring(0, 8),
    cepOrigem: str.substring(8, 16),
    dvCepDestino: str.substring(16, 17),
    codigoRastreamento: str.substring(17, 30),
    servicosAdicionais: str.substring(30, 38),
    codigoCartaoPostagem: str.substring(38, 41),
    codigoServico: str.substring(41, 46),
    infoAgrupamento: str.substring(46, 48),
    numeroVolume: str.substring(48, 50),
    pesoGramas: str.substring(50, 55),
    telefoneDestinatario: str.substring(56, 68),
    latitude: str.substring(68, 73),
    longitude: str.substring(73, 78),
    complementoDestino: str.substring(79, 108),
    valorDeclarado: str.substring(109, 149),
    numeroNfe: str.substring(150, 160),
  };
}

/**
 * Formata CEP para exibição (00000-000)
 */
export function formatCep(cep: string): string {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return cep;
  return `${clean.substring(0, 5)}-${clean.substring(5)}`;
}

/**
 * Formata código de rastreamento para exibição (XX000000000XX)
 */
export function formatTrackingCode(code: string): string {
  // Já está formatado, retorna como está
  return code.toUpperCase();
}

/**
 * Determina o símbolo de encaminhamento baseado no código de serviço
 */
export function getRoutingSymbol(serviceCode: string): RoutingSymbol {
  const symbolMap: Record<string, RoutingSymbol> = {
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

  return symbolMap[serviceCode] || "GENERIC";
}

/**
 * Retorna o nome amigável do serviço
 */
export function getServiceDisplayName(serviceCode: string): string {
  const nameMap: Record<string, string> = {
    "04014": "SEDEX",
    "40010": "SEDEX",
    "04510": "PAC",
    "41106": "PAC",
    "04782": "SEDEX 12",
    "04790": "SEDEX 10",
    "04804": "SEDEX Hoje",
    "03298": "Mini Envios PAC",
    "03220": "Mini Envios SEDEX",
  };

  return nameMap[serviceCode] || serviceCode;
}

/**
 * Valida código de rastreamento Correios
 * Formato: 2 letras + 9 números + 2 letras (BR)
 */
export function isValidTrackingCode(code: string): boolean {
  const regex = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
  return regex.test(code.toUpperCase());
}

/**
 * Calcula o dígito verificador do código de rastreamento
 * Usado para validar códigos de rastreamento
 */
export function calculateTrackingCheckDigit(code: string): number {
  // Extrai os 8 primeiros dígitos numéricos
  const match = code.match(/^[A-Z]{2}(\d{8})/);
  if (!match) return -1;

  const digits = match[1].split("").map(Number);
  const weights = [8, 6, 4, 2, 3, 5, 9, 7];

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }

  const remainder = sum % 11;
  let checkDigit: number;

  if (remainder === 0) {
    checkDigit = 5;
  } else if (remainder === 1) {
    checkDigit = 0;
  } else {
    checkDigit = 11 - remainder;
  }

  return checkDigit;
}

/**
 * Formata o peso para exibição
 */
export function formatWeight(weightKg: number): string {
  if (weightKg < 1) {
    return `${Math.round(weightKg * 1000)}g`;
  }
  return `${weightKg.toFixed(2)}kg`;
}

/**
 * Formata valor em reais
 */
export function formatCurrency(valueInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}
