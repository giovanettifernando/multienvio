/**
 * Types para sistema de coletas
 * Migrado para usar contratos globais de /types/contracts.ts
 */

import { CollectionStatus } from '@/shared/types/contracts';

// Re-exportar enum para retrocompatibilidade
export { CollectionStatus };
export type ColetaStatus = CollectionStatus;

/**
 * @deprecated Use Collection.origin do contrato global
 * Mantido temporariamente para retrocompatibilidade
 */
export interface ColetaOrigem {
  nome: string;
  telefone: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface Coleta {
  id: string;
  shipmentId: string; // ID do envio/etiqueta associado
  status: ColetaStatus;
  origem: ColetaOrigem;
  janelaColeta?: string | null; // ISO date/datetime se houver janela agendada
  transportadora?: string | null;
  servico?: string | null;
  observacoes?: string | null;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export interface ColetaFilters {
  q?: string; // Busca por shipmentId, cidade, UF
  status?: ColetaStatus | "all";
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
  page?: number;
  pageSize?: number;
  sort?: "updated_desc" | "updated_asc" | "created_desc" | "created_asc";
}

export interface ColetaListResponse {
  items: Coleta[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateColetaInput {
  shipmentId: string;
  origem: ColetaOrigem;
  janelaColeta?: string | null;
  transportadora?: string | null;
  servico?: string | null;
  observacoes?: string | null;
}

export interface UpdateColetaInput {
  status?: ColetaStatus;
  janelaColeta?: string | null;
  observacoes?: string | null;
}
