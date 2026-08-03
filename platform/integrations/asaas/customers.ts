import 'server-only';
import { asaasRequest } from './client';
import type { AsaasCustomer, AsaasListResponse } from './types';

export interface GetOrCreateCustomerInput {
  name: string;
  email: string;
  document?: string; // CPF/CNPJ com ou sem pontuação
  phone?: string;
}

export interface CustomersDeps {
  request?: typeof asaasRequest;
}

/**
 * Busca o cliente pelo CPF/CNPJ e cria apenas se não existir.
 *
 * Diferente do Pagar.me, o POST /v3/customers do Asaas NÃO faz upsert por e-mail:
 * chamar duas vezes cria dois clientes. Por isso a consulta prévia é obrigatória.
 */
export async function getOrCreateCustomer(
  input: GetOrCreateCustomerInput,
  deps: CustomersDeps = {},
): Promise<AsaasCustomer> {
  const request = deps.request ?? asaasRequest;
  const document = input.document?.replace(/\D/g, '');

  if (document) {
    const existing = await request<AsaasListResponse<AsaasCustomer>>(
      `/v3/customers?cpfCnpj=${document}&limit=1`,
    );
    if (existing.data?.length > 0) {
      return existing.data[0];
    }
  }

  const body: Record<string, unknown> = { name: input.name, email: input.email };
  if (document) body.cpfCnpj = document;

  const phone = input.phone?.replace(/\D/g, '');
  if (phone && phone.length >= 10) body.mobilePhone = phone;

  return request<AsaasCustomer>('/v3/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCustomerById(customerId: string): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>(`/v3/customers/${customerId}`);
}
