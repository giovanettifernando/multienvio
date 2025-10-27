/**
 * Types para sistema de coletas
 */

export type ColetaStatus = "agendada" | "reagendada" | "concluida" | "cancelada";

export interface Coleta {
  id: string;
  trackingCode: string; // código de rastreio (mesmo usado na Gestão de Envios)
  origemCep: string;
  destinoCep: string;
  scheduledFor: string; // ISO date (yyyy-mm-dd)
  status: ColetaStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ColetaFilters {
  q?: string;
  status?: ColetaStatus | "all";
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
  page?: number;
  pageSize?: number;
  sort?: "scheduledFor_asc" | "scheduledFor_desc" | "created_asc" | "created_desc";
}

export interface ColetaListResponse {
  items: Coleta[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateColetaInput {
  trackingCode: string;
  origemCep: string;
  destinoCep: string;
  scheduledFor: string;
}

export interface UpdateColetaInput {
  scheduledFor: string;
}
