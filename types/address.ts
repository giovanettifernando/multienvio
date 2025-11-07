/**
 * Address Types
 * Types for address management in the quote system
 */

export type AddressRole = 'sender' | 'recipient';

export interface Address {
  id: string;
  role: AddressRole | null;
  name: string | null;
  cpfCnpj: string | null;
  label: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string | null;
  isDefault: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddressCreatePayload {
  role: AddressRole;
  name: string;
  cpfCnpj?: string | null;
  label?: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  referencia?: string | null;
  isDefault?: boolean;
}

export interface AddressListResponse {
  addresses: Address[];
}

export interface AddressCreateResponse {
  address: Address;
}

/**
 * Formato do select (para componente AddressSelect)
 */
export interface AddressSelectOption {
  value: string; // address.id
  label: string; // Formatado: "Nome - Rua X, 123 - Bairro - Cidade/UF"
  address: Address;
}
