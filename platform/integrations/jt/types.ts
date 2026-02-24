/**
 * Tipos TypeScript para integração J&T Express Brasil
 */

// ============================================================================
// Configuração
// ============================================================================

export interface JTConfig {
  environment: 'sandbox' | 'production';
  apiBase: string;
  costApiBase: string;
  customerCode: string;
  password: string;
  apiAccount: string;
  privateKey: string;
}

// ============================================================================
// Cotação (getComCostAndTime)
// ============================================================================

export interface JTCostTimeRequest {
  customerCode: string;
  digest: string;
  destinationZipCode: string;
  originZipCode?: string;
  productTypeCode: string;
  weight: string;
  insuredAmount?: string;
  goodsTypeCode?: string;
  serviceMethodCode?: string;
  smMode?: number;
  quoteType?: number;
}

export interface JTCostTimeData {
  /** Frete (em reais, string) */
  cost: string;
  /** Prazo de entrega em dias */
  aging: number;
  /** Seguro + taxa de risco */
  riskPremiumFee: string;
  /** Seguro + taxa de risco + frete */
  riskPremiumWaybillFee: string;
}

export interface JTCostTimeResponse {
  code: string;
  msg: string;
  data: JTCostTimeData;
}

// ============================================================================
// Criação de Pedido (addOrder)
// ============================================================================

export interface JTSenderReceiver {
  name: string;
  company?: string;
  postCode: string;
  mailBox?: string;
  taxNumber?: string;
  mobile?: string;
  phone?: string;
  prov: string;
  city: string;
  street: string;
  streetNumber?: string;
  address?: string;
  areaCode?: string;
  ieNumber?: string;
  area?: string;
}

export interface JTOrderItem {
  itemType?: string;
  itemName: string;
  number: number;
  desc?: string;
  itemNcm?: string;
}

export interface JTAddOrderRequest {
  customerCode: string;
  digest: string;
  txlogisticId: string;
  expressType: string;
  orderType: string;
  serviceType: string;
  deliveryType: string;
  sender: JTSenderReceiver;
  receiver: JTSenderReceiver;
  translate: JTSenderReceiver;
  goodsType?: string;
  weight: string;
  height?: number;
  width?: number;
  length?: number;
  totalQuantity?: number;
  items?: JTOrderItem[];
  invoiceNumber?: string;
  invoiceSerialNumber?: string;
  invoiceMoney?: string;
  taxCode?: string;
  invoiceAccessKey?: string;
  invoiceIssueDate?: string;
  invoiceType?: string;
}

export interface JTAddOrderResponse {
  code: number;
  msg: string;
  data?: {
    billCode?: string;
    lastCenterName?: string;
    sortingCode?: string;
    createOrderTime?: string;
    orderList?: Array<{
      txlogisticId: string;
      billCode: string;
    }>;
    [key: string]: unknown;
  };
}

// ============================================================================
// Etiqueta (printOrder)
// ============================================================================

export interface JTPrintOrderRequest {
  customerCode: string;
  digest: string;
  billCode: string;
  printSize: number;
}

export interface JTPrintOrderResponse {
  code: number;
  msg: string;
  data?: {
    billCode: string;
    base64EncodeContent: string;
  };
}

// ============================================================================
// Resposta genérica da API
// ============================================================================

export interface JTApiResponse<T = unknown> {
  code: string | number;
  msg: string;
  data?: T;
}

// ============================================================================
// Erros
// ============================================================================

export class JTApiError extends Error {
  public readonly code: string | number;
  public readonly apiMessage: string;

  constructor(code: string | number, apiMessage: string) {
    super(`J&T API Error [${code}]: ${apiMessage}`);
    this.name = 'JTApiError';
    this.code = code;
    this.apiMessage = apiMessage;
  }
}

export class JTAuthError extends Error {
  constructor(message: string) {
    super(`J&T Auth Error: ${message}`);
    this.name = 'JTAuthError';
  }
}
