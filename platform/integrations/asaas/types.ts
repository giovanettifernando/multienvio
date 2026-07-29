// platform/integrations/asaas/types.ts

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'DEBIT_CARD' | 'UNDEFINED';

export interface AsaasConfig {
  apiKey: string;       // $aact_hmlg_... (sandbox) ou $aact_prod_... (produção)
  baseUrl: string;      // https://api-sandbox.asaas.com ou https://api.asaas.com
  webhookToken?: string; // valor esperado no header asaas-access-token
  sandboxMode: boolean;
}

export interface AsaasCustomer {
  id: string;           // cus_000008517065
  name: string;
  email?: string;
  cpfCnpj?: string;
  mobilePhone?: string;
}

export interface AsaasCreditCardInfo {
  creditCardNumber: string;  // últimos 4 dígitos
  creditCardBrand: string;   // MASTERCARD, VISA...
  creditCardToken: string;
}

export interface AsaasCharge {
  id: string;                 // pay_3v9st3v3mm884zkc
  customer: string;
  status: string;             // PENDING | CONFIRMED | RECEIVED | OVERDUE | REFUNDED...
  billingType: AsaasBillingType;
  value: number;              // reais
  netValue?: number;          // reais, já descontada a taxa
  dueDate: string;            // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;       // PDF do boleto
  installment?: string;       // id do parcelamento, quando parcelado
  installmentCount?: number;
  creditCard?: AsaasCreditCardInfo;
  confirmedDate?: string;
  paymentDate?: string;
  dateCreated?: string;
}

export interface AsaasPixQrCode {
  success: boolean;
  encodedImage: string;   // PNG em base64
  payload: string;        // copia-e-cola
  expirationDate: string;
}

export interface AsaasBoletoIdentification {
  identificationField: string; // linha digitável
  nossoNumero: string;
  barCode: string;
}

export interface AsaasTokenizeResponse {
  creditCardNumber: string;
  creditCardBrand: string;
  creditCardToken: string;
}

export interface AsaasWebhookPayload {
  id: string;             // evt_...
  event: string;          // PAYMENT_CONFIRMED | PAYMENT_RECEIVED | ...
  dateCreated: string;
  payment: AsaasCharge;
}

export interface AsaasListResponse<T> {
  object: 'list';
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
}

export class AsaasApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AsaasApiError';
  }
}
