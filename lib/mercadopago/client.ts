/**
 * Cliente Mercado Pago usando SDK oficial
 *
 * Referências:
 * - SDK Node.js: https://github.com/mercadopago/sdk-nodejs
 * - Documentação: https://www.mercadopago.com.ar/developers/en/docs/checkout-api/overview
 */

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getMercadoPagoConfig } from './config';
import type {
  CreatePaymentInput,
  MercadoPagoPaymentResponse,
  ProcessedPaymentData,
} from './types';
import { PaymentMethod, TransactionStatus } from '@prisma/client';

/**
 * Inicializa cliente do Mercado Pago
 */
async function getClient() {
  const config = await getMercadoPagoConfig();

  if (!config) {
    throw new Error('Mercado Pago não configurado');
  }

  // Debug: verificar se accessToken está presente
  console.log('[MERCADO_PAGO_CLIENT] Config recuperada:', {
    hasPublicKey: !!config.publicKey,
    hasAccessToken: !!config.accessToken,
    accessTokenLength: config.accessToken?.length || 0,
    accessTokenPreview: config.accessToken ? `${config.accessToken.substring(0, 15)}...` : 'VAZIO',
    sandboxMode: config.sandboxMode,
  });

  if (!config.accessToken || config.accessToken.trim().length === 0) {
    throw new Error('Access Token não configurado ou vazio');
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
 * Cria um pagamento no Mercado Pago
 *
 * @param input Dados do pagamento
 * @returns Dados do pagamento criado
 */
export async function createPayment(
  input: CreatePaymentInput
): Promise<MercadoPagoPaymentResponse> {
  const { client } = await getClient();
  const payment = new Payment(client);

  // Montar payload para o Mercado Pago
  const paymentData: Record<string, unknown> = {
    transaction_amount: input.transactionAmount,
    description: input.description || 'Pagamento Envio Legal',
    payment_method_id: input.paymentMethodId,
    payer: {
      email: input.payer.email,
      first_name: input.payer.firstName,
      last_name: input.payer.lastName,
    },
  };

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

  try {
    const response = await payment.create({ body: paymentData });
    return response as unknown as MercadoPagoPaymentResponse;
  } catch (error: unknown) {
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
    const response = await payment.get({ id: paymentId });
    return response as unknown as MercadoPagoPaymentResponse;
  } catch (error: unknown) {
    console.error('[MERCADO_PAGO] Erro ao buscar pagamento:', error);
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
