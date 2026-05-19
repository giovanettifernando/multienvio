import 'server-only';
import { pagarmeRequest } from './client';
import type { PagarmeCustomer } from './types';

export interface GetOrCreateCustomerInput {
  userId: string;
  name: string;
  email: string;
  document?: string;    // CPF without punctuation
  phone?: string;       // e.g. "11987654321"
}

export async function getOrCreateCustomer(
  input: GetOrCreateCustomerInput,
): Promise<PagarmeCustomer> {
  const body: Record<string, unknown> = {
    name: input.name,
    email: input.email,
    type: 'individual',
  };

  if (input.document) {
    body.document = input.document.replace(/\D/g, '');
    body.document_type = 'cpf';
  }

  if (input.phone) {
    const digits = input.phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      body.phones = {
        mobile_phone: {
          country_code: '55',
          area_code: digits.slice(0, 2),
          number: digits.slice(2),
        },
      };
    }
  }

  // POST /customers with email upserts: if email exists, updates the customer
  return pagarmeRequest<PagarmeCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCustomerById(customerId: string): Promise<PagarmeCustomer> {
  return pagarmeRequest<PagarmeCustomer>(`/customers/${customerId}`);
}
