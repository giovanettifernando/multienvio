/**
 * Types para Pontos de Coleta
 * Usa enum do contrato global, estrutura local para compatibilidade
 */

import { PickupPointStatus } from '@/shared/types/contracts';

// Re-exportar para retrocompatibilidade
export { PickupPointStatus };
export type StatusOperacional = PickupPointStatus;

export type PixType = "cpf" | "cnpj" | "email" | "phone" | "random";

export type MetodoPagamento =
  | { kind: "pix"; pixType: PixType; pixKey: string }
  | {
      kind: "transfer";
      bankCode: string;
      branch: string;
      account: string;
      accountType: "corrente" | "poupanca";
      holderName: string;
      holderDocument: string;
    };

/**
 * PickupPoint - estrutura local com endereço flat
 */
export interface PickupPoint {
  id: string;
  status: PickupPointStatus;

  // PJ
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie?: string | null;
  email?: string | null;
  telefone?: string | null;

  // Endereço (flat para compatibilidade)
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;

  // Geolocalização (opcional)
  geo?: {
    lat: number;
    lng: number;
  } | null;

  // Pagamento/Comissões
  paymentMethod: MetodoPagamento;
  payoutDay?: number | null;
  minPayoutAmount?: number | null;
  commissionPerItem?: number | null;

  // Operação
  capacityPerDay?: number | null;
  monthlyReceived?: number;

  updatedAt: string;
  createdAt: string;
}

/**
 * Form data - mesma estrutura que PickupPoint
 */
export type PickupPointFormData = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie?: string;
  email?: string;
  telefone?: string;
  password?: string; // Senha para acesso ao portal do coletor
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  geo?: {
    lat: number;
    lng: number;
  } | null;
  paymentMethod: MetodoPagamento;
  payoutDay?: number;
  minPayoutAmount?: number;
  commissionPerItem?: number | null;
  capacityPerDay?: number | null;
};

export interface PickupPointFilters {
  q?: string;
  status?: PickupPointStatus | "all";
  uf?: string;
  cidade?: string;
  page?: number;
  pageSize?: number;
  sort?: "name_asc" | "name_desc" | "updated_desc" | "updated_asc";
}

export interface PickupPointListResponse {
  items: PickupPoint[];
  total: number;
  page: number;
  pageSize: number;
}
