import 'server-only';
import { asaasRequest } from './client';
import { toReais } from './money';
import { mapMethodToBillingType } from './status';
import type { AsaasCharge, AsaasPixQrCode, AsaasBoletoIdentification } from './types';

export interface CreateChargeInput {
  customerId: string;
  amountCents: number;
  description: string;
  referenceId: string;
  dueDate: string;                 // YYYY-MM-DD
  paymentMethod: 'pix' | 'credit_card' | 'boleto';
  cardToken?: string;
  remoteIp?: string;               // IP do cliente final — obrigatório para cartão
  installments?: number;
}

export interface ChargesDeps {
  request?: typeof asaasRequest;
}

/**
 * Cria uma cobrança no Asaas.
 *
 * Diferente do modelo de "order" do gateway anterior, toda cobrança do Asaas tem
 * vencimento (dueDate). Para compra à vista, quem chama passa a data de hoje.
 */
export async function createCharge(
  input: CreateChargeInput,
  deps: ChargesDeps = {},
): Promise<AsaasCharge> {
  const request = deps.request ?? asaasRequest;

  const body: Record<string, unknown> = {
    customer: input.customerId,
    billingType: mapMethodToBillingType(input.paymentMethod),
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.referenceId,
  };

  if (input.paymentMethod === 'credit_card') {
    if (!input.cardToken) {
      throw new Error('createCharge: cartão exige creditCardToken');
    }
    if (!input.remoteIp) {
      throw new Error('createCharge: remoteIp é obrigatório para cartão');
    }
    body.creditCardToken = input.cardToken;
    body.remoteIp = input.remoteIp;
  }

  // O Asaas rejeita value e totalValue juntos: parcelado usa totalValue.
  if (input.installments && input.installments > 1) {
    body.installmentCount = input.installments;
    body.totalValue = toReais(input.amountCents);
  } else {
    body.value = toReais(input.amountCents);
  }

  return request<AsaasCharge>('/v3/payments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCharge(chargeId: string): Promise<AsaasCharge> {
  return asaasRequest<AsaasCharge>(`/v3/payments/${chargeId}`);
}

/** Estorna a cobrança. Sem amountCents, estorna o valor integral. */
export async function refundCharge(
  chargeId: string,
  amountCents?: number,
  deps: ChargesDeps = {},
): Promise<AsaasCharge> {
  const request = deps.request ?? asaasRequest;
  const body = amountCents != null ? { value: toReais(amountCents) } : {};

  return request<AsaasCharge>(`/v3/payments/${chargeId}/refund`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getPixQrCode(chargeId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(`/v3/payments/${chargeId}/pixQrCode`);
}

export async function getBoletoIdentification(
  chargeId: string,
): Promise<AsaasBoletoIdentification> {
  return asaasRequest<AsaasBoletoIdentification>(
    `/v3/payments/${chargeId}/identificationField`,
  );
}
