import 'server-only';
import { asaasRequest } from './client';
import type { AsaasTokenizeResponse } from './types';

export interface TokenizeCardInput {
  customerId: string;
  holderName: string;
  number: string;
  expiryMonth: number;
  expiryYear: number;
  ccv: string;
  remoteIp: string;
  holder: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
}

export interface CardsDeps {
  request?: typeof asaasRequest;
}

/**
 * Tokeniza o cartão no Asaas.
 *
 * Roda no servidor — diferente do gateway anterior, não há chamada do navegador
 * e portanto não há problema de CORS. O token gerado só pode ser cobrado para o
 * mesmo customerId que o originou.
 */
export async function tokenizeCard(
  input: TokenizeCardInput,
  deps: CardsDeps = {},
): Promise<AsaasTokenizeResponse> {
  const request = deps.request ?? asaasRequest;

  if (!input.remoteIp) {
    throw new Error('tokenizeCard: remoteIp é obrigatório');
  }

  const body = {
    customer: input.customerId,
    creditCard: {
      holderName: input.holderName,
      number: input.number.replace(/\D/g, ''),
      expiryMonth: String(input.expiryMonth).padStart(2, '0'),
      expiryYear: String(input.expiryYear),
      ccv: input.ccv,
    },
    creditCardHolderInfo: {
      name: input.holder.name,
      email: input.holder.email,
      cpfCnpj: input.holder.cpfCnpj.replace(/\D/g, ''),
      postalCode: input.holder.postalCode.replace(/\D/g, ''),
      addressNumber: input.holder.addressNumber,
      phone: input.holder.phone.replace(/\D/g, ''),
    },
    remoteIp: input.remoteIp,
  };

  return request<AsaasTokenizeResponse>('/v3/creditCard/tokenizeCreditCard', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
