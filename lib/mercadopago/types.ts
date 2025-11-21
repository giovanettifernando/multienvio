/**
 * Tipos TypeScript para integração com Mercado Pago
 *
 * Baseado na documentação oficial:
 * - Checkout API: https://www.mercadopago.com.ar/developers/en/docs/checkout-api/overview
 * - Webhooks: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
 */

import { PaymentMethod, TransactionStatus } from '@prisma/client';

/**
 * Configuração do Mercado Pago
 */
export interface MercadoPagoConfig {
  publicKey: string;
  accessToken: string;
  webhookSecret?: string;
  sandboxMode: boolean;
}

/**
 * Dados para criação de pagamento
 * Baseado no formato do Payment Brick / Checkout API
 */
export interface CreatePaymentInput {
  // Dados do pagamento
  transactionAmount: number; // Em reais (não centavos)
  token?: string; // Token do cartão (gerado no frontend)
  paymentMethodId: string; // 'pix', 'credit_card', 'debit_card', 'boleto', etc
  installments?: number;

  // Dados do pagador
  payer: {
    email: string;
    firstName?: string;
    lastName?: string;
    identification?: {
      type: string; // 'CPF', 'CNPJ'
      number: string;
    };
  };

  // Metadados internos (não enviados ao MP, usado para controle interno)
  metadata?: {
    type: 'wallet_topup' | 'checkout_payment';
    userId: string;
    walletId?: string;
    shipmentId?: string;
    [key: string]: unknown;
  };

  // Descrição do pagamento
  description?: string;

  // Dados específicos por método
  cardData?: {
    cardholderName: string;
  };
}

/**
 * Resposta do Mercado Pago após criar pagamento
 */
export interface MercadoPagoPaymentResponse {
  id: number; // ID do pagamento no MP
  status: string; // 'pending', 'approved', 'rejected', etc
  status_detail: string;
  transaction_amount: number;
  date_created: string;
  date_approved?: string;
  payment_method_id: string;
  payment_type_id: string;
  installments: number;
  transaction_details?: {
    net_received_amount?: number;
    total_paid_amount?: number;
    installment_amount?: number;
  };
  fee_details?: Array<{
    type: string;
    amount: number;
  }>;
  // PIX specific
  point_of_interaction?: {
    type: string;
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
  // Boleto specific
  barcode?: {
    content?: string;
  };
  external_reference?: string;
}

/**
 * Dados de pagamento processados para uso interno
 */
export interface ProcessedPaymentData {
  externalId: string; // ID do MP
  status: TransactionStatus;
  amountCents: number;
  feeCents: number;
  netCents: number;
  method: PaymentMethod;
  cardBrand?: string;
  cardLast4?: string;
  pixQrCode?: string;
  pixKey?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  authorizedAt?: Date;
  paidAt?: Date;
}

/**
 * Payload do webhook do Mercado Pago
 */
export interface MercadoPagoWebhookPayload {
  id: number;
  live_mode: boolean;
  type: string; // 'payment', 'subscription', etc
  date_created: string;
  user_id: number;
  api_version: string;
  action: string; // 'payment.created', 'payment.updated', etc
  data: {
    id: string; // ID do recurso (payment, order, etc)
  };
}

/**
 * Headers do webhook (para validação de assinatura)
 */
export interface WebhookHeaders {
  'x-signature'?: string;
  'x-request-id'?: string;
}

/**
 * Mapeamento de status do Mercado Pago para status interno
 */
export const MP_STATUS_MAP: Record<string, TransactionStatus> = {
  // Pendentes
  pending: 'PENDING',
  in_process: 'PENDING',
  in_mediation: 'PENDING',

  // Aprovados
  approved: 'PAID',
  authorized: 'AUTHORIZED',

  // Cancelados/Rejeitados
  rejected: 'FAILED',
  cancelled: 'CANCELED',
  refunded: 'REFUNDED',
  charged_back: 'CHARGEBACK',
};

/**
 * Mapeamento de payment_type_id do MP para PaymentMethod interno
 */
export const MP_METHOD_MAP: Record<string, PaymentMethod> = {
  credit_card: 'CREDIT_CARD',
  debit_card: 'DEBIT_CARD',
  account_money: 'WALLET',
  ticket: 'BOLETO',
  bank_transfer: 'PIX',
};

/**
 * Erro da API do Mercado Pago
 */
export interface MercadoPagoApiError {
  status: number;
  error: string;
  message: string;
  cause?: Array<{
    code: string;
    description: string;
  }>;
}
