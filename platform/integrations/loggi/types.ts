/**
 * Tipos da integração Loggi
 */

// ============================================================================
// Configuração
// ============================================================================

export interface LoggiConfig {
  environment: 'sandbox' | 'production';
  apiBase: string;
  clientId: string;
  clientSecret: string;
  companyId: string;
}

// ============================================================================
// Autenticação
// ============================================================================

export interface LoggiTokenResponse {
  idToken: string;
  expiresIn: string;
}

export interface LoggiAuthTestResult {
  success: boolean;
  message: string;
  tokenPrefix?: string;
  expiresIn?: string;
  error?: string;
  latencyMs: number;
}

// ============================================================================
// Valores monetários
// ============================================================================

/** Representação monetária da Loggi: units = parte inteira, nanos = fração (× 10^9) */
export interface LoggiMoney {
  currencyCode: string;
  /** Parte inteira — API retorna como string */
  units: string | number;
  /** Fracao em nano (10^9) */
  nanos: number;
}

// ============================================================================
// Endereços
// ============================================================================

export interface LoggiCorreiosAddress {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
}

export interface LoggiLineAddress {
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  state: string;
  country?: string;
}

export interface LoggiAddress {
  correios?: LoggiCorreiosAddress;
  lines?: LoggiLineAddress;
}

// ============================================================================
// Cotação (Quotation)
// ============================================================================

export interface LoggiQuotePackage {
  weightG: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  goodsValue?: LoggiMoney;
}

export interface LoggiQuoteRequest {
  shipFrom: LoggiAddress;
  shipTo: LoggiAddress;
  packages: LoggiQuotePackage[];
  pickupTypes?: string[];
  externalServiceIds?: string[];
}

export interface LoggiTaxFee {
  amount: LoggiMoney;
  rateTax: string;
}

export interface LoggiQuotationPrice {
  totalAmount: LoggiMoney;
  baseAmount: LoggiMoney;
  taxesAndFees?: {
    pis?: LoggiTaxFee;
    cofins?: LoggiTaxFee;
    gris?: LoggiTaxFee;
    advalorem?: LoggiTaxFee;
    icms?: LoggiTaxFee;
    iss?: LoggiTaxFee;
  };
}

export interface LoggiQuotation {
  price: LoggiQuotationPrice;
  sloInDays: number;
  freightType: string;
  freightTypeLabel: string;
  pickupType: string;
  externalServiceId: string;
}

export interface LoggiPackageQuotation {
  quotations: LoggiQuotation[];
}

export interface LoggiQuoteResponse {
  packagesQuotations: LoggiPackageQuotation[];
}

// ============================================================================
// Shipment (Criação de Envio)
// ============================================================================

export interface LoggiShipmentParty {
  name: string;
  email?: string;
  phoneNumber?: string;
  federalTaxId: string;
  stateTaxId?: string;
  address: {
    instructions?: string;
    correiosAddress?: LoggiCorreiosAddress;
    lineAddress?: LoggiLineAddress;
  };
}

export interface LoggiInvoice {
  key: string;
  series: string;
  number: string;
  totalValue: string;
  authorizationProtocol?: string;
  icms?: string;
  items?: Array<{ description: string }>;
}

export interface LoggiContentDeclaration {
  totalValue: string;
  description: string;
  items?: Array<{
    description: string;
    quantity?: number;
    unitaryValue?: string;
    unitaryWeightG?: number;
  }>;
}

export interface LoggiShipmentPackage {
  trackingCode?: string;
  barcode?: string;
  freightType: string;
  weightG: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  sequence?: string;
  packaged?: boolean;
  labelled?: boolean;
  documentTypes?: Array<{
    subPackageNumber?: string;
    invoice?: LoggiInvoice;
    contentDeclaration?: LoggiContentDeclaration;
  }>;
}

export interface LoggiShipmentRequest {
  externalServiceId: string;
  shipFrom: LoggiShipmentParty;
  shipTo: LoggiShipmentParty;
  returnTo?: LoggiShipmentParty;
  shippingCompany?: {
    name: string;
    federalTaxId: string;
  };
  packages: LoggiShipmentPackage[];
}

export interface LoggiShipmentResponsePackage {
  trackingCode: string;
  barcode: string;
  loggiKey: string;
  sequence?: string;
}

export interface LoggiShipmentResponse {
  packages: LoggiShipmentResponsePackage[];
}

// ============================================================================
// Etiqueta (Label)
// ============================================================================

export interface LoggiLabelRequest {
  loggiKeys: string[];
  responseType: string;
  format?: string;
  layout?: string;
}

export interface LoggiLabelSuccess {
  content?: string;
  url?: string;
  createdTime: string;
}

export interface LoggiLabelFailure {
  loggiKey: string;
  status: {
    code: number;
    message: string;
    details: unknown[];
  };
}

export interface LoggiLabelResponse {
  success: LoggiLabelSuccess;
  failure: LoggiLabelFailure[];
}

// ============================================================================
// Rastreamento (Tracking)
// ============================================================================

export interface LoggiTrackingStatus {
  code: number;
  highLevelStatus: string;
  description: string;
  actionRequired?: {
    reasonLabel: string;
    reasonDescription: string;
  };
  updatedTime: string;
}

export interface LoggiTrackingPackage {
  loggiKey: string;
  trackingCode: string;
  status: LoggiTrackingStatus;
  location?: {
    city: string;
    state: string;
  };
  promisedDate?: string;
  requestTime?: string;
  trackingHistory: LoggiTrackingStatus[];
  deliveryInformation?: {
    receiverName?: string;
    receiverDocument?: string;
    locationDescription?: string;
    links?: string[];
  };
}

export interface LoggiTrackingResponse {
  packages: LoggiTrackingPackage[];
}

// ============================================================================
// Erros
// ============================================================================

export class LoggiApiError extends Error {
  public details?: unknown[];
  constructor(
    public code: string | number,
    message: string,
    details?: unknown[],
  ) {
    super(`Loggi API Error [${code}]: ${message}`);
    this.name = 'LoggiApiError';
    this.details = details;
  }
}

export class LoggiAuthError extends Error {
  constructor(message: string) {
    super(`Loggi Auth Error: ${message}`);
    this.name = 'LoggiAuthError';
  }
}

// ============================================================================
// API Response genérica (para erros)
// ============================================================================

export interface LoggiErrorResponse {
  code: number;
  message: string;
  details?: unknown[];
}
