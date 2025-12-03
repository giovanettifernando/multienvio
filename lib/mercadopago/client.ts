/**
 * Cliente Mercado Pago usando SDK oficial
 *
 * Referências:
 * - SDK Node.js: https://github.com/mercadopago/sdk-nodejs
 * - Documentação: https://www.mercadopago.com.ar/developers/en/docs/checkout-api/overview
 */

import { MercadoPagoConfig, Payment, CardToken } from 'mercadopago';
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

  if (!config.accessToken || config.accessToken.trim().length === 0) {
    throw new Error('Access Token não configurado ou vazio');
  }

  const sdkOptions = {
    timeout: 30000,
  };

  const client = new MercadoPagoConfig({
    accessToken: config.accessToken,
    options: sdkOptions,
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
  const { config } = await getClient();

  // Email do pagador
  // Em sandbox com MP_TEST_USER_EMAIL configurado, usa esse email
  // Isso permite testar com usuários de teste do MP
  const payerEmail = config.sandboxMode && process.env.MP_TEST_USER_EMAIL
    ? process.env.MP_TEST_USER_EMAIL
    : input.payer.email;

  // Nome do pagador baseado nos dados do cartão
  // Em sandbox, usar "APRO" simula aprovação automática
  let payerFirstName: string | undefined;
  let payerLastName: string | undefined;

  if (input.cardData?.cardholderName) {
    const nameParts = input.cardData.cardholderName.trim().split(/\s+/);
    payerFirstName = nameParts[0];
    payerLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
  } else if (config.sandboxMode) {
    payerFirstName = 'APRO';
  } else if (input.payer.firstName) {
    payerFirstName = input.payer.firstName;
    payerLastName = input.payer.lastName;
  }

  // Montar payload MÍNIMO obrigatório para Checkout Transparente
  const paymentData: Record<string, unknown> = {
    // OBRIGATÓRIOS
    transaction_amount: input.transactionAmount,
    payment_method_id: input.paymentMethodId,
    payer: {
      email: payerEmail,
    },
  };

  // Token e parcelas (obrigatórios para cartão)
  if (input.token) {
    paymentData.token = input.token;
    paymentData.installments = input.installments || 1;
  }

  // OPCIONAIS - Adicionar apenas se fornecidos (melhora rastreabilidade)
  if (input.description) {
    paymentData.description = input.description;
  }

  // Nome do pagador (opcional, mas recomendado)
  const payer = paymentData.payer as Record<string, unknown>;
  if (payerFirstName) {
    payer.first_name = payerFirstName;
  }
  if (payerLastName) {
    payer.last_name = payerLastName;
  }

  // Identificação do pagador (opcional, melhora aprovação)
  if (input.payer.identification?.number) {
    payer.identification = {
      type: input.payer.identification.type || 'CPF',
      number: input.payer.identification.number,
    };
  }

  // Referência externa para conciliação (opcional)
  if (input.metadata) {
    paymentData.external_reference = JSON.stringify(input.metadata);
  }

  try {
    const { client } = await getClient();
    const payment = new Payment(client);

    // Idempotency key para evitar pagamentos duplicados
    const idempotencyKey = input.metadata?.transactionId
      ? `tx-${input.metadata.transactionId}`
      : `pay-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const result = await payment.create({
      body: paymentData as Parameters<typeof payment.create>[0]['body'],
      requestOptions: {
        idempotencyKey,
      },
    });

    return result as unknown as MercadoPagoPaymentResponse;
  } catch (error: unknown) {
    const errorObj = error as { message?: string };
    throw new Error(
      `Erro ao criar pagamento: ${errorObj.message || 'Erro desconhecido'}`
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
    const tokenData = await cardToken.create({
      body: {
        card_number: cardData.cardNumber,
        expiration_month: cardData.expirationMonth,
        expiration_year: cardData.expirationYear,
        security_code: cardData.securityCode,

        // @ts-ignore - MP SDK types are incomplete, cardholder is required
        cardholder: {
          name: cardholderName,
          identification: {
            type: cardData.identificationType,
            number: cardData.identificationNumber,
          },
        },
      },
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
    const errorObj = error as { message?: string };
    throw new Error(`Erro ao criar token: ${errorObj.message || 'Erro desconhecido'}`);
  }
}
