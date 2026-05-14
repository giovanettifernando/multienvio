// platform/integrations/total-express/types.ts

// ============================================================================
// Configuração
// ============================================================================

export interface TEConfig {
  environment: 'sandbox' | 'production';
  apiBase: string;
  soapBase: string;
  username: string;
  password: string;
  remetenteId: string;
  cnpj: string;
}

// ============================================================================
// Cotação (SOAP)
// ============================================================================

export interface TECotacaoInput {
  cepOrigem: string;
  cepDestino: string;
  pesoG: number;
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
  valorDeclaradoCentavos?: number;
}

export interface TECotacaoResult {
  tipoServico: string;
  prazo: number;
  valorCentavos: number;
}

// ============================================================================
// Smart Label (Order Registration)
// ============================================================================

export interface TEAddress {
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  telefone?: string;
  email?: string;
  cnpjCpf?: string;
}

export interface TEVolume {
  peso: number;
  comprimento: number;
  largura: number;
  altura: number;
}

export interface TENotaFiscal {
  numero: string;
  serie: string;
  chaveAcesso: string;
  dataEmissao?: string;
  valorTotal: number;
}

export interface TESmartLabelRequest {
  tipo_servico: string;
  tipo_entrega: string;
  remetente: TEAddress;
  destinatario: TEAddress;
  volumes: TEVolume[];
  conteudo?: string;
  nota_fiscal?: TENotaFiscal;
  numero_pedido?: string;
  valor_declarado?: number;
}

export interface TESmartLabelVolumeResponse {
  awb: string;
  status: number;
  mensagem?: string;
}

export interface TESmartLabelResponse {
  status: number;
  mensagem?: string;
  volumes?: TESmartLabelVolumeResponse[];
  awb?: string;
}

// ============================================================================
// Tracking
// ============================================================================

export interface TETrackingEvent {
  data: string;
  hora?: string;
  status: string;
  descricao: string;
  local?: string;
}

export interface TETrackingPackage {
  awb: string;
  status_atual: string;
  previsao_entrega?: string;
  eventos: TETrackingEvent[];
}

export interface TETrackingResponse {
  status: number;
  mensagem?: string;
  encomendas?: TETrackingPackage[];
}

// ============================================================================
// Erros
// ============================================================================

export class TEApiError extends Error {
  public readonly code: string | number;
  public readonly apiMessage: string;

  constructor(code: string | number, apiMessage: string) {
    super(`Total Express API Error [${code}]: ${apiMessage}`);
    this.name = 'TEApiError';
    this.code = code;
    this.apiMessage = apiMessage;
  }
}

export class TEAuthError extends Error {
  constructor(message: string) {
    super(`Total Express Auth Error: ${message}`);
    this.name = 'TEAuthError';
  }
}

export interface TEAuthTestResult {
  success: boolean;
  message: string;
  error?: string;
  latencyMs: number;
}
