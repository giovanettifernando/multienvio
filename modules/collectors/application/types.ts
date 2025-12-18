import type { FieldValues } from 'react-hook-form';
import type { CollectorFormSchemaInput, CollectorFormSchemaType } from './schemas';
// Import base types for use in this file
import type {
  CollectorStatus,
  PixKeyType,
  AccountType,
  CommissionModel,
  BankMethod,
} from './base-types';

// Re-export base types
export type {
  CollectorStatus,
  PixKeyType,
  AccountType,
  CommissionModel,
  BankMethod,
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
  cpf: string;
  email: string;
  password?: string | null;
  confirmPassword?: string | null;
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
  endereco: Endereco;
  usarEnderecoFisico?: boolean;
}

export interface Vehicle {
  plate: string;
  brand: string;
  model?: string | null;
  year?: string | null;
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
  status?: 'active' | 'inactive' | 'blocked' | 'all';
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
