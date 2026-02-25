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
  applicationId?: string;
  webhookSecret?: string;
  notificationUrl?: string; // URL para receber webhooks (notification_url)
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

  // Device fingerprint para antifraude
  deviceSessionId?: string;

  // Tempo de expiração em minutos (para PIX)
  // Se não fornecido, usa o padrão do MP (~24h)
  expirationMinutes?: number;
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
 * Mapeamento de status_detail para mensagens amigáveis ao usuário
 *
 * @see https://www.mercadopago.com.br/developers/pt/docs/checkout-api/response-handling/handle-responses
 */
export const STATUS_DETAIL_MESSAGES: Record<string, string> = {
  // Aprovado
  accredited: 'Pagamento aprovado com sucesso',

  // Pendentes
  pending_contingency: 'Pagamento em análise, aguarde confirmação',
  pending_review_manual: 'Pagamento em análise manual',
  pending_waiting_payment: 'Aguardando pagamento',
  pending_waiting_transfer: 'Aguardando transferência PIX',

  // Rejeitados - Cartão
  cc_rejected_bad_filled_card_number: 'Número do cartão inválido',
  cc_rejected_bad_filled_date: 'Data de validade inválida',
  cc_rejected_bad_filled_other: 'Dados do cartão incorretos',
  cc_rejected_bad_filled_security_code: 'Código de segurança inválido',
  cc_rejected_blacklist: 'Cartão não autorizado',
  cc_rejected_call_for_authorize: 'Ligue para sua operadora e autorize o pagamento',
  cc_rejected_card_disabled: 'Cartão desabilitado. Ative pelo app do seu banco',
  cc_rejected_card_error: 'Erro no cartão. Tente outro cartão',
  cc_rejected_duplicated_payment: 'Pagamento duplicado. Verifique seus extratos',
  cc_rejected_high_risk: 'Pagamento recusado por suspeita de fraude',
  cc_rejected_insufficient_amount: 'Saldo insuficiente no cartão',
  cc_rejected_invalid_installments: 'Número de parcelas não permitido',
  cc_rejected_max_attempts: 'Limite de tentativas atingido. Tente outro cartão',
  cc_rejected_other_reason: 'Cartão não autorizado. Tente outro cartão',

  // Rejeitados - Outros
  rejected_by_bank: 'Pagamento recusado pelo banco',
  rejected_by_regulations: 'Pagamento não permitido por regulamentação',
  rejected_insufficient_data: 'Dados insuficientes para processar',
  rejected_high_risk: 'Pagamento recusado por análise de risco',

  // Cancelados
  expired: 'Pagamento expirado',
  by_collector: 'Pagamento cancelado pelo vendedor',
  by_payer: 'Pagamento cancelado pelo comprador',
};

/**
 * Obtém mensagem amigável para o usuário baseado no status_detail
 *
 * @param statusDetail Código do status_detail do Mercado Pago
 * @returns Mensagem amigável ao usuário
 */
export function getStatusDetailMessage(statusDetail: string): string {
  return STATUS_DETAIL_MESSAGES[statusDetail] || 'Pagamento não autorizado. Tente novamente';
}
