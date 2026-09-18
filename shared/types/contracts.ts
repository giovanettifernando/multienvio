/**
 * Contratos Globais (DTOs + Enums unificados)
 * Fonte da verdade para todos os domínios do sistema
 * Versão: 1.0.0
 */

// ============================================================================
// ENUMS GLOBAIS
// ============================================================================

/**
 * Status de Envio/Shipment
 */
export enum ShipmentStatus {
  CRIADO = "criado",
  ETIQUETA_EMITIDA = "etiqueta_emitida",
  POSTADO = "postado",
  EM_TRANSPORTE = "em_transporte",
  ENTREGUE = "entregue",
  CANCELADO = "cancelado",
}

/**
 * Status de Coleta/Collection
 */
export enum CollectionStatus {
  ABERTA = "aberta",
  AGENDADA = "agendada",
  EM_ANDAMENTO = "em_andamento",
  CONCLUIDA = "concluida",
  CANCELADA = "cancelada",
}

/**
 * Status de Ticket de Suporte
 */
export enum SupportStatus {
  ABERTO = "aberto",
  EM_ATENDIMENTO = "em_atendimento",
  RESOLVIDO = "resolvido",
  FECHADO = "fechado",
}

/**
 * Prioridade de Ticket de Suporte
 */
export enum SupportPriority {
  BAIXA = "baixa",
  MEDIA = "media",
  ALTA = "alta",
  CRITICA = "critica",
}


/**
 * Status de Usuário
 */
export enum UserStatus {
  ACTIVE = "active",
  BLOCKED = "blocked",
}

/**
 * Roles de Autenticação
 */
export enum AuthRole {
  ADMIN = "admin",
  SUPORTE = "suporte",
  OPERACOES = "operacoes",
  FINANCEIRO = "financeiro",
  GERENTE = "gerente",
}

// ============================================================================
// CONTRATOS (DTOs)
// ============================================================================

/**
 * Endereço padronizado
 */
export interface Address {
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

/**
 * Contrato: Envio/Shipment
 */
export interface Shipment {
  id: string;
  trackingCode: string;
  status: ShipmentStatus;
  carrier: string;
  service: string;
  origin: Address;
  destination: Address;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string | null;
  volumes: Array<{
    id: string;
    weight: number;
    length: number;
    width: number;
    height: number;
  }>;
  freightValue: number;
  insuranceValue?: number | null;
  etaDays: number;
  expectedDeliveryDate?: string | null;
  postedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contrato: Coleta/Collection
 */
export interface Collection {
  id: string;
  shipmentId: string;
  status: CollectionStatus;
  origin: {
    name: string;
    phone: string;
    address: Address;
  };
  scheduledWindow?: string | null; // ISO datetime
  carrier?: string | null;
  service?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}


/**
 * Contrato: Ticket de Suporte
 */
export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: SupportStatus;
  priority: SupportPriority;
  category: string;
  requester: {
    name: string;
    email: string;
    phone?: string | null;
    userId?: string | null;
  };
  linkedTrackingCode?: string | null;
  assigneeUserId?: string | null;
  slaDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contrato: Mensagem de Suporte
 */
export interface SupportMessage {
  id: string;
  ticketId: string;
  author: "cliente" | "suporte";
  authorName: string;
  content: string;
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    size: number;
  }>;
  createdAt: string;
}

/**
 * Contrato: Usuário
 */
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: UserStatus;
  roles: AuthRole[];
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// UTILITÁRIOS DE LABEL E COR
// ============================================================================

/**
 * Labels de exibição para CollectionStatus
 */
export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  [CollectionStatus.ABERTA]: "Aberta",
  [CollectionStatus.AGENDADA]: "Agendada",
  [CollectionStatus.EM_ANDAMENTO]: "Em Andamento",
  [CollectionStatus.CONCLUIDA]: "Concluída",
  [CollectionStatus.CANCELADA]: "Cancelada",
};

/**
 * Cores (Ant Design) para CollectionStatus
 */
export const COLLECTION_STATUS_COLORS: Record<CollectionStatus, string> = {
  [CollectionStatus.ABERTA]: "default",
  [CollectionStatus.AGENDADA]: "blue",
  [CollectionStatus.EM_ANDAMENTO]: "processing",
  [CollectionStatus.CONCLUIDA]: "success",
  [CollectionStatus.CANCELADA]: "error",
};

/**
 * Labels de exibição para SupportStatus
 */
export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  [SupportStatus.ABERTO]: "Aberto",
  [SupportStatus.EM_ATENDIMENTO]: "Em Atendimento",
  [SupportStatus.RESOLVIDO]: "Resolvido",
  [SupportStatus.FECHADO]: "Fechado",
};

/**
 * Cores (Ant Design) para SupportStatus
 */
export const SUPPORT_STATUS_COLORS: Record<SupportStatus, string> = {
  [SupportStatus.ABERTO]: "error",
  [SupportStatus.EM_ATENDIMENTO]: "processing",
  [SupportStatus.RESOLVIDO]: "success",
  [SupportStatus.FECHADO]: "default",
};

/**
 * Labels de exibição para SupportPriority
 */
export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
  [SupportPriority.BAIXA]: "Baixa",
  [SupportPriority.MEDIA]: "Média",
  [SupportPriority.ALTA]: "Alta",
  [SupportPriority.CRITICA]: "Crítica",
};

/**
 * Cores (Ant Design) para SupportPriority
 */
export const SUPPORT_PRIORITY_COLORS: Record<SupportPriority, string> = {
  [SupportPriority.BAIXA]: "default",
  [SupportPriority.MEDIA]: "blue",
  [SupportPriority.ALTA]: "warning",
  [SupportPriority.CRITICA]: "error",
};

/**
 * Labels de exibição para UserStatus
 */
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: "Ativo",
  [UserStatus.BLOCKED]: "Bloqueado",
};

/**
 * Cores (Ant Design) para UserStatus
 */
export const USER_STATUS_COLORS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: "success",
  [UserStatus.BLOCKED]: "error",
};

/**
 * Labels de exibição para AuthRole
 */
export const AUTH_ROLE_LABELS: Record<AuthRole, string> = {
  [AuthRole.ADMIN]: "Administrador",
  [AuthRole.SUPORTE]: "Suporte",
  [AuthRole.OPERACOES]: "Operações",
  [AuthRole.FINANCEIRO]: "Financeiro",
  [AuthRole.GERENTE]: "Gerente",
};
