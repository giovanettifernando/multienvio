// platform/integrations/pagarme/types.ts

export interface PagarmeConfig {
  secretKey: string;    // sk_test_... or sk_live_...
  publicKey: string;    // pk_test_... or pk_live_...
  baseUrl: string;      // https://sdx-api.pagar.me/core/v5 or prod
  sandboxMode: boolean;
}

export interface PagarmeCustomer {
  id: string;           // cus_XXXXXXXXXXXXXXXX
  name: string;
  email: string;
  document?: string;
  phones?: {
    mobile_phone?: { country_code: string; area_code: string; number: string };
  };
}

export interface PagarmeCard {
  id: string;           // card_XXXXXXXXXXXXXXXX
  first_six_digits: string;
  last_four_digits: string;
  brand: string;
  holder_name: string;
  exp_month: number;
  exp_year: number;
  status: 'active' | 'deleted' | 'expired';
}

export interface PagarmeOrderItem {
  amount: number;       // centavos
  description: string;
  quantity: number;
  code: string;
}

export interface PagarmeLastTransaction {
  id: string;
  status: string;       // waiting_payment | paid | refunded
  qr_code?: string;     // PIX copia-cola string
  qr_code_url?: string; // PIX PNG image URL
  card?: PagarmeCard;
}

export interface PagarmeCharge {
  id: string;           // ch_XXXXXXXXXXXXXXXX
  status: string;       // pending | paid | canceled
  amount: number;
  paid_amount?: number;
  canceled_amount?: number;
  payment_method: string;
  last_transaction: PagarmeLastTransaction;
}

export interface PagarmeOrder {
  id: string;           // or_XXXXXXXXXXXXXXXX
  status: string;       // pending | paid | canceled | failed
  amount: number;
  charges: PagarmeCharge[];
  customer?: PagarmeCustomer;
  metadata?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface PagarmeWebhookPayload {
  id: string;           // hook_XXXXXXXXXXXXXXXX
  type: string;         // order.paid | charge.refunded | etc.
  created_at: string;
  data: PagarmeOrder | PagarmeCharge;
}

export class PagarmeApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'PagarmeApiError';
  }
}
