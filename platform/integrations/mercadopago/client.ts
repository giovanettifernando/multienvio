/**
 * Cliente Mercado Pago usando SDK oficial
 *
 * Referências:
 * - SDK Node.js: https://github.com/mercadopago/sdk-nodejs
 * - Documentação: https://www.mercadopago.com.ar/developers/en/docs/checkout-api/overview
 *
 * SECURITY: Protegido por Circuit Breaker para evitar sobrecarga em falhas
 */

import { MercadoPagoConfig, Payment, CardToken, PaymentRefund } from 'mercadopago';
import { getMercadoPagoConfig } from './config';
import type {
  CreatePaymentInput,
  MercadoPagoPaymentResponse,
  ProcessedPaymentData,
} from './types';
import { PaymentMethod, TransactionStatus } from '@prisma/client';
import {
  mercadoPagoCircuitBreaker,
  CircuitBreakerError,
} from '../shared/circuit-breaker';

/**
 * Inicializa cliente do Mercado Pago
 */
async function getClient() {
  const config = await getMercadoPagoConfig();

  if (!config) {
    throw new Error('Mercado Pago não configurado');
  }

  const client = new MercadoPagoConfig({
    accessToken: config.accessToken,
    options: {
      timeout: 30000,
    },
  });

  return { client, config };
}

/**
 * Cria um pagamento no Mercado Pago via Checkout Transparente
 *
 * Campos OBRIGATÓRIOS (mínimo para funcionar):
 * - transaction_amount: valor do pagamento
 * - token: token do cartão gerado no frontend ou backend
 * - installments: número de parcelas (mínimo 1)
 * - payment_method_id: bandeira do cartão (visa, master, etc)
 * - payer.email: email do comprador
 *
 * Campos OPCIONAIS (melhoram rastreabilidade):
 * - description: descrição do pagamento
 * - payer.first_name, payer.last_name: nome do comprador
 * - payer.identification: CPF/CNPJ do comprador
 * - external_reference: referência externa para conciliação
 *
 * @see https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/card/integrate-via-cardform
 * @param input Dados do pagamento
 * @returns Dados do pagamento criado
 */
export async function createPayment(
  input: CreatePaymentInput
): Promise<MercadoPagoPaymentResponse> {
  const { client, config } = await getClient();
  const payment = new Payment(client);

  // Montar payload para o Mercado Pago (formato original que funcionava)
  // Em Sandbox, usar email de teste para evitar erro "Payer email forbidden"
  const payerEmail = config.sandboxMode ? 'test@test.com' : input.payer.email;

  const paymentData: Record<string, unknown> = {
    transaction_amount: input.transactionAmount,
    description: input.description || 'Pagamento Envio Legal',
    payment_method_id: input.paymentMethodId,
    payer: {
      email: payerEmail,
      first_name: input.payer.firstName,
      last_name: input.payer.lastName,
    },
  };

  // Adicionar notification_url para receber webhooks
  if (config.notificationUrl) {
    paymentData.notification_url = config.notificationUrl;
  }

  // Adicionar token se for pagamento com cartão
  if (input.token) {
    paymentData.token = input.token;
    paymentData.installments = input.installments || 1;
  }

  // Adicionar identificação se fornecida
  if (input.payer.identification) {
    const payer = paymentData.payer as Record<string, unknown>;
    payer.identification = {
      type: input.payer.identification.type,
      number: input.payer.identification.number,
    };
  }

  // Adicionar dados do cartão se fornecidos
  if (input.cardData) {
    const existingAdditionalInfo = (paymentData.additional_info as Record<string, unknown>) || {};
    const existingPayer = (existingAdditionalInfo.payer as Record<string, unknown>) || {};

    paymentData.additional_info = {
      ...existingAdditionalInfo,
      payer: {
        ...existingPayer,
        first_name: input.payer.firstName,
        last_name: input.payer.lastName,
      },
    };
  }

  // Adicionar external_reference se houver metadata
  if (input.metadata) {
    paymentData.external_reference = JSON.stringify(input.metadata);
  }

  // Adicionar device fingerprint para antifraude
  if (input.deviceSessionId) {
    const additionalInfo = (paymentData.additional_info as Record<string, unknown>) || {};
    paymentData.additional_info = {
      ...additionalInfo,
      ip_address: input.deviceSessionId,
    };
  }

  // Adicionar date_of_expiration para PIX
  // Default: 30 minutos se não especificado para PIX
  if (input.paymentMethodId === 'pix') {
    const expirationMinutes = input.expirationMinutes || 30;
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + expirationMinutes);
    // Formato ISO 8601: 2024-01-15T10:30:00.000-03:00
    paymentData.date_of_expiration = expirationDate.toISOString();
  }

  try {
    // SECURITY: Circuit breaker protege contra chamadas a serviço indisponível
    const response = await mercadoPagoCircuitBreaker.execute(async () => {
      return await payment.create({ body: paymentData });
    });
    return response as unknown as MercadoPagoPaymentResponse;
  } catch (error: unknown) {
    // Converter CircuitBreakerError para mensagem amigável
    if (error instanceof CircuitBreakerError) {
      throw new Error(
        'Serviço de pagamento temporariamente indisponível. Tente novamente em alguns minutos.'
      );
    }

    console.error('[MERCADO_PAGO] Erro ao criar pagamento:', error);

    // Extrair detalhes do erro do MP
    const mpError = (error as { cause?: unknown[] }).cause?.[0] || error;
    const errorObj = mpError as { description?: string; message?: string };
    throw new Error(
      `Erro ao criar pagamento: ${errorObj.description || errorObj.message || 'Erro desconhecido'}`
    );
  }
}

/**
 * Busca detalhes de um pagamento pelo ID
 *
 * @param paymentId ID do pagamento no Mercado Pago
 * @returns Dados do pagamento
 */
export async function getPaymentById(paymentId: string): Promise<MercadoPagoPaymentResponse> {
  const { client } = await getClient();
  const payment = new Payment(client);

  try {
    // SECURITY: Circuit breaker protege contra chamadas a serviço indisponível
    const response = await mercadoPagoCircuitBreaker.execute(async () => {
      return await payment.get({ id: paymentId });
    });
    return response as unknown as MercadoPagoPaymentResponse;
  } catch (error: unknown) {
    if (error instanceof CircuitBreakerError) {
      throw new Error(
        'Serviço de pagamento temporariamente indisponível. Tente novamente em alguns minutos.'
      );
    }
    const errorObj = error as { message?: string };
    throw new Error(`Erro ao buscar pagamento: ${errorObj.message || 'Erro desconhecido'}`);
  }
}

/**
 * Mapeia status do Mercado Pago para status interno
 */
export function mapMercadoPagoStatus(mpStatus: string): TransactionStatus {
  const statusMap: Record<string, TransactionStatus> = {
    pending: 'PENDING',
    in_process: 'PENDING',
    in_mediation: 'PENDING',
    approved: 'PAID',
    authorized: 'AUTHORIZED',
    rejected: 'FAILED',
    cancelled: 'CANCELED',
    refunded: 'REFUNDED',
    charged_back: 'CHARGEBACK',
  };

  return statusMap[mpStatus] || 'PENDING';
}

/**
 * Mapeia payment_type_id do MP para PaymentMethod interno
 */
export function mapMercadoPagoMethod(paymentTypeId: string): PaymentMethod {
  const methodMap: Record<string, PaymentMethod> = {
    credit_card: 'CREDIT_CARD',
    debit_card: 'DEBIT_CARD',
    account_money: 'WALLET',
    ticket: 'BOLETO',
    bank_transfer: 'PIX',
  };

  return methodMap[paymentTypeId] || 'CREDIT_CARD';
}

/**
 * Processa dados do pagamento do MP para formato interno
 */
export function processPaymentData(
  mpPayment: MercadoPagoPaymentResponse
): ProcessedPaymentData {
  const amountCents = Math.round(mpPayment.transaction_amount * 100);

  // Calcular taxa
  const totalFee = mpPayment.fee_details?.reduce((sum, fee) => sum + fee.amount, 0) || 0;
  const feeCents = Math.round(totalFee * 100);

  // Calcular net amount
  const netAmount = mpPayment.transaction_details?.net_received_amount ||
                   (mpPayment.transaction_amount - totalFee);
  const netCents = Math.round(netAmount * 100);

  // Extrair dados do PIX
  let pixQrCode: string | undefined;
  let pixKey: string | undefined;

  if (mpPayment.point_of_interaction?.transaction_data) {
    pixQrCode = mpPayment.point_of_interaction.transaction_data.qr_code;
    pixKey = mpPayment.point_of_interaction.transaction_data.qr_code_base64;
  }

  // Extrair dados do Boleto
  let boletoUrl: string | undefined;
  let boletoBarcode: string | undefined;

  if (mpPayment.point_of_interaction?.transaction_data?.ticket_url) {
    boletoUrl = mpPayment.point_of_interaction.transaction_data.ticket_url;
  }

  if (mpPayment.barcode?.content) {
    boletoBarcode = mpPayment.barcode.content;
  }

  // Datas importantes
  const authorizedAt = mpPayment.status === 'authorized' && mpPayment.date_created
    ? new Date(mpPayment.date_created)
    : undefined;

  const paidAt = mpPayment.date_approved ? new Date(mpPayment.date_approved) : undefined;

  return {
    externalId: mpPayment.id.toString(),
    status: mapMercadoPagoStatus(mpPayment.status),
    amountCents,
    feeCents,
    netCents,
    method: mapMercadoPagoMethod(mpPayment.payment_type_id),
    cardBrand: undefined, // Será extraído do payment_method_id se for cartão
    cardLast4: undefined, // MP não retorna isso diretamente
    pixQrCode,
    pixKey,
    boletoUrl,
    boletoBarcode,
    authorizedAt,
    paidAt,
  };
}

/**
 * Cria um token de cartão usando SDK backend
 * NOTA: Esta função deve receber dados do cartão já descriptografados
 *
 * @param cardData Dados do cartão para tokenização
 * @returns Token criado
 */
export async function createCardToken(cardData: {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  identificationType: string;
  identificationNumber: string;
}): Promise<{ id: string; first_six_digits: string; last_four_digits: string }> {
  const { client, config } = await getClient();
  const cardToken = new CardToken(client);

  // Em sandbox, usar APRO como nome do titular para forçar aprovação
  // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards
  const cardholderName = config.sandboxMode ? 'APRO' : cardData.cardholderName;

  try {
    // SECURITY: Circuit breaker protege contra chamadas a serviço indisponível
    const tokenData = await mercadoPagoCircuitBreaker.execute(async () => {
      return await cardToken.create({
        body: {
          card_number: cardData.cardNumber,
          expiration_month: cardData.expirationMonth,
          expiration_year: cardData.expirationYear,
          security_code: cardData.securityCode,

          // @ts-expect-error - MP SDK types are incomplete, cardholder is required
          cardholder: {
            name: cardholderName,
            identification: {
              type: cardData.identificationType,
              number: cardData.identificationNumber,
            },
          },
        },
      });
    });

    if (!tokenData.id) {
      throw new Error('Token ID não retornado pelo Mercado Pago');
    }

    return {
      id: tokenData.id,
      first_six_digits: tokenData.first_six_digits || '',
      last_four_digits: tokenData.last_four_digits || '',
    };
  } catch (error: unknown) {
    if (error instanceof CircuitBreakerError) {
      throw new Error(
        'Serviço de pagamento temporariamente indisponível. Tente novamente em alguns minutos.'
      );
    }
    const errorObj = error as { message?: string };
    throw new Error(`Erro ao criar token: ${errorObj.message || 'Erro desconhecido'}`);
  }
}

/**
 * Reembolsa um pagamento (total ou parcial)
 *
 * @param paymentId ID do pagamento no Mercado Pago
 * @param amount Valor a reembolsar (opcional, se não informado, reembolso total)
 * @returns Dados do reembolso
 *
 * @see https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/cancel-and-refund
 */
export async function refundPayment(
  paymentId: string,
  amount?: number
): Promise<{ id: number; status: string; amount: number }> {
  const { client } = await getClient();
  const refund = new PaymentRefund(client);

  try {
    // SECURITY: Circuit breaker protege contra chamadas a serviço indisponível
    const refundData = await mercadoPagoCircuitBreaker.execute(async () => {
      return await refund.create({
        payment_id: paymentId,
        body: amount ? { amount } : {},
      });
    });

    return {
      id: refundData.id ?? 0,
      status: refundData.status ?? 'unknown',
      amount: refundData.amount ?? 0,
    };
  } catch (error: unknown) {
    if (error instanceof CircuitBreakerError) {
      throw new Error(
        'Serviço de pagamento temporariamente indisponível. Tente novamente em alguns minutos.'
      );
    }
    console.error('[MERCADO_PAGO] Erro ao reembolsar pagamento:', error);
    const errorObj = error as { message?: string };
    throw new Error(`Erro ao reembolsar: ${errorObj.message || 'Erro desconhecido'}`);
  }
}

/**
 * Retorna o estado atual do circuit breaker do Mercado Pago
 * Útil para monitoramento e diagnóstico
 */
export function getMercadoPagoCircuitBreakerState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
  return mercadoPagoCircuitBreaker.getState();
}

/**
 * Reseta o circuit breaker do Mercado Pago (para admin/debug)
 */
export function resetMercadoPagoCircuitBreaker(): void {
  mercadoPagoCircuitBreaker.reset();
}
