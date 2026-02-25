/**
 * Mercado Pago Cards & Customers API
 *
 * Gerencia customers e cards salvos no Mercado Pago
 * Permite pagamentos com cartões previamente cadastrados
 *
 * Referências:
 * - Customers API: https://www.mercadopago.com.br/developers/pt/reference/customers/_customers/post
 * - Cards API: https://www.mercadopago.com.br/developers/pt/reference/cards/_customers_customer_id_cards/post
 * - Save Cards: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/payment-methods/cards/save-cards
 */

import { MercadoPagoConfig, CustomerCard } from 'mercadopago';
import { getMercadoPagoConfig } from './config';

/**
 * Inicializa cliente do Mercado Pago
 */
async function getClient() {
  const config = await getMercadoPagoConfig();

  if (!config || !config.accessToken) {
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
 * Dados para criar Customer no Mercado Pago
 */
export interface CreateCustomerInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: {
    areaCode: string;
    number: string;
  };
  identification?: {
    type: string; // CPF, CNPJ, etc
    number: string;
  };
  description?: string;
}

/**
 * Resposta do Mercado Pago ao criar Customer
 */
export interface MercadoPagoCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: {
    area_code: string;
    number: string;
  };
  identification?: {
    type: string;
    number: string;
  };
  date_created: string;
}

/**
 * Dados para criar Card no Mercado Pago
 */
export interface CreateCardInput {
  token: string; // Token do cartão (gerado pelo SDK no frontend)
}

/**
 * Resposta do Mercado Pago ao criar Card
 */
export interface MercadoPagoCard {
  id: string;
  customer_id: string;
  expiration_month: number;
  expiration_year: number;
  first_six_digits: string;
  last_four_digits: string;
  payment_method: {
    id: string; // visa, master, etc
    name: string;
    payment_type_id: string;
  };
  security_code: {
    length: number;
    card_location: string;
  };
  issuer: {
    id: number;
    name: string;
  };
  cardholder: {
    name: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  date_created: string;
  date_last_updated: string;
}

/**
 * Dados para criar pagamento com cartão salvo
 */
export interface CreatePaymentWithSavedCardInput {
  customerId: string;
  token: string; // Token do CVV gerado no frontend (recomendado)
  paymentMethodId: string; // visa, master, etc
  transactionAmount: number;
  description?: string;
  installments?: number;
  metadata?: Record<string, unknown>;
  payer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Cria um Card para um Customer no Mercado Pago
 *
 * @param customerId ID do customer no MP
 * @param input Dados do cartão (token)
 * @returns Card criado no MP
 */
export async function createCard(
  customerId: string,
  input: CreateCardInput
): Promise<MercadoPagoCard> {
  const { client } = await getClient();
  const customerCard = new CustomerCard(client);

  console.log('[MP_CARDS] Criando card para customer:', {
    customerId,
    hasToken: !!input.token,
  });

  try {
    const result = await customerCard.create({
      customerId,
      body: {
        token: input.token,
      },
    });

    console.log('[MP_CARDS] Card criado:', {
      id: result.id,
      customerId: result.customer_id,
      last4: result.last_four_digits,
      brand: result.payment_method?.id,
    });

    return result as MercadoPagoCard;
  } catch (error) {
    console.error('[MP_CARDS] Erro ao criar card:', error);
    throw new Error(`Erro ao criar cartão no Mercado Pago: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Lista todos os Cards de um Customer
 *
 * @param customerId ID do customer no MP
 * @returns Lista de cards
 */
export async function listCards(customerId: string): Promise<MercadoPagoCard[]> {
  const { client } = await getClient();
  const customerCard = new CustomerCard(client);

  try {
    const result = await customerCard.list({ customerId });
    return (result || []) as MercadoPagoCard[];
  } catch (error) {
    console.error('[MP_CARDS] Erro ao listar cards:', error);
    return [];
  }
}

/**
 * Remove um Card de um Customer
 *
 * @param customerId ID do customer no MP
 * @param cardId ID do card no MP
 */
export async function deleteCard(
  customerId: string,
  cardId: string
): Promise<void> {
  const { client } = await getClient();
  const customerCard = new CustomerCard(client);

  console.log('[MP_CARDS] Removendo card:', {
    customerId,
    cardId,
  });

  try {
    await customerCard.remove({
      customerId,
      cardId,
    });

    console.log('[MP_CARDS] Card removido com sucesso');
  } catch (error) {
    console.error('[MP_CARDS] Erro ao remover card:', error);
    throw new Error(`Erro ao remover cartão no Mercado Pago: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Cria um pagamento com cartão salvo
 *
 * IMPORTANTE: O token deve ser gerado no frontend usando o SDK do Mercado Pago
 * com o cardId e CVV. Nunca envie o CVV diretamente para o backend.
 *
 * @param input Dados do pagamento
 * @returns Dados do pagamento criado
 */
export async function createPaymentWithSavedCard(
  input: CreatePaymentWithSavedCardInput
): Promise<Record<string, unknown>> {
  await getClient(); // Valida config

  console.log('[MP_CARDS] Criando pagamento com cartão salvo:', {
    customerId: input.customerId,
    amount: input.transactionAmount,
    paymentMethodId: input.paymentMethodId,
    installments: input.installments || 1,
  });

  try {
    // Usar API direta do MP (Payment SDK tem limitações para saved cards)
    const accessToken = (await getMercadoPagoConfig())?.accessToken;

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        transaction_amount: input.transactionAmount,
        token: input.token,
        installments: input.installments || 1,
        payment_method_id: input.paymentMethodId,
        payer: {
          id: input.customerId,
          email: input.payer?.email,
          first_name: input.payer?.firstName,
          last_name: input.payer?.lastName,
        },
        description: input.description || 'Recarga de carteira',
        metadata: input.metadata || {},
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro ao criar pagamento: ${errorData.message || response.statusText}`);
    }

    const payment = await response.json();

    console.log('[MP_CARDS] Pagamento criado:', {
      id: payment.id,
      status: payment.status,
      statusDetail: payment.status_detail,
    });

    return payment;
  } catch (error) {
    console.error('[MP_CARDS] Erro ao criar pagamento com cartão salvo:', error);
    throw error;
  }
}

