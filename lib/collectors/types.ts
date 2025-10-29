import type { FieldValues } from 'react-hook-form';
import type { CollectorFormSchemaInput, CollectorFormSchemaType } from './schemas';

export type CollectorStatus = 'active' | 'blocked';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
export type AccountType = 'corrente' | 'poupanca';

export type CommissionModel =
  | { kind: 'fixa'; amount: number }
  | { kind: 'porKm'; amountPerKm: number };

export type BankMethod =
  | { kind: 'pix'; pixType: PixKeyType; pixKey: string }
  | {
      kind: 'transfer';
      bankCode: string;
      branch: string;
      account: string;
      accountType: AccountType;
      holderName: string;
      holderCnpj: string;
    };

export interface Endereco {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export interface PessoaFisica {
  nome: string;
  cnh: {
    number: string;
    category: string;
    expiresAt: string;
  };
  endereco: Endereco;
  celular: string;
  whatsapp?: string | null;
  usarMesmoNumero?: boolean;
}

export interface PessoaJuridica {
  razaoSocial: string;
  cnpj: string;
  email?: string | null;
  telefone?: string | null;
  endereco: Endereco;
}

export interface Vehicle {
  plate: string;
  brand: string;
  model?: string | null;
  year?: string | null;
  renavam: string;
}

export interface Documents {
  cnhFiles: Array<{
    uid: string;
    name: string;
    url?: string;
    status?: 'uploading' | 'done' | 'error';
  }>;
  crlvFile: Array<{
    uid: string;
    name: string;
    url?: string;
    status?: 'uploading' | 'done' | 'error';
  }>;
  pfAddressProofFile: Array<{
    uid: string;
    name: string;
    url?: string;
    status?: 'uploading' | 'done' | 'error';
  }>;
}

export interface Collector {
  id: string;
  status: CollectorStatus;
  pf: PessoaFisica;
  pj: PessoaJuridica;
  vehicle: Vehicle;
  documents: Documents;
  commission: CommissionModel;
  bank: BankMethod;
  createdAt: string;
  updatedAt: string;
}

export type CollectorFormInput = CollectorFormSchemaInput & FieldValues;
export type CollectorFormData = CollectorFormSchemaType & FieldValues;

export interface CollectorFilters {
  q?: string;
  status?: CollectorStatus | 'all';
  uf?: string;
  cidade?: string;
  page?: number;
  pageSize?: number;
  sort?: 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc';
}

export interface CollectorListResponse {
  items: Collector[];
  total: number;
  page: number;
  pageSize: number;
}

// Legacy types for backward compatibility (deprecated)
export interface CNH {
  number: string;
  category: string;
  expiresAt: string;
  frontFileUrl: string;
  backFileUrl: string;
}

export interface AddressProof {
  provider: string;
  documentNumber: string;
  issuedAt: string;
  fileUrl: string;
}
