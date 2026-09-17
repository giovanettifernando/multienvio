/**
 * Types para o módulo de pagamento pelo destinatário
 */

import type {
  RecipientPaymentRequest,
  RecipientPaymentPackage,
  RecipientPaymentStatus,
} from '@prisma/client';

// Re-export do enum do Prisma
export { RecipientPaymentStatus } from '@prisma/client';

/**
 * Dados de um volume para criação do request
 */
export interface PackageInput {
  packageNumber: number;
  width: number;
  height: number;
  length: number;
  weight: number;
}

/**
 * Dados de origem para criação do request
 */
export interface OriginInput {
  addressId?: string;
  cep: string;
  city: string;
  state: string;
  address?: string;
  neighborhood?: string;
  number?: string;
  complement?: string;
}

/**
 * Dados de destino para criação do request
 */
export interface DestinationInput {
  cep: string;
  city: string;
  state: string;
  address?: string;
  neighborhood?: string;
  number?: string;
  complement?: string;
}

/**
 * Dados do destinatário para criação do request
 */
export interface RecipientInput {
  name: string;
  email: string;
  phone?: string;
  document?: string;
}

/**
 * Dados da cotação selecionada
 */
export interface QuoteInput {
  carrier: string;
  service: string;
  serviceCode?: string;
  estimatedDays?: number;
  freightCostCents: number;
  totalCents: number;
  shippingCommissionCents?: number;
}

/**
 * Input para criar um novo RecipientPaymentRequest
 */
export interface CreateRecipientPaymentInput {
  senderId: string;
  origin: OriginInput;
  destination: DestinationInput;
  recipient: RecipientInput;
  packages: PackageInput[];
  quote: QuoteInput;
  totalWeight: number;
  declaredValue: number;
  document?: Record<string, unknown>;
}

/**
 * Request com packages incluídos
 */
export type RecipientPaymentRequestWithPackages = RecipientPaymentRequest & {
  packages: RecipientPaymentPackage[];
};

/**
 * Dados públicos para página de pagamento (sem dados sensíveis)
 */
export interface PublicPaymentData {
  id: string;
  paymentToken: string;
  status: RecipientPaymentStatus;
  expiresAt: Date;

  // Dados do remetente (apenas nome)
  senderName: string;

  // Origem (apenas cidade/estado)
  originCity: string;
  originState: string;

  // Destino
  destinationCity: string;
  destinationState: string;

  // Destinatário
  recipientName: string;
  recipientEmail: string;

  // Valores
  totalCents: number;
  freightCostCents: number;

  // Transportadora
  carrier: string;
  service: string;
  estimatedDays: number | null;

  // Volumes
  packagesCount: number;
  totalWeight: number;
}

/**
 * Resultado do processamento de pagamento
 */
export interface ProcessPaymentResult {
  success: boolean;
  shipmentId?: string;
  platformTrackingCode?: string;
  publicTrackingId?: string | null;
  error?: string;
}

/**
 * Filtros para listagem de requests
 */
export interface ListRequestsFilters {
  status?: RecipientPaymentStatus;
  limit?: number;
  offset?: number;
}

/**
 * Resultado da listagem de requests
 */
export interface ListRequestsResult {
  requests: RecipientPaymentRequestWithPackages[];
  total: number;
  hasMore: boolean;
}

/**
 * Configuração de expiração
 */
export const PAYMENT_EXPIRATION_HOURS = 72;

/**
 * Calcula a data de expiração a partir de agora
 */
export function calculateExpirationDate(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PAYMENT_EXPIRATION_HOURS);
  return expiresAt;
}

/**
 * Verifica se um request está expirado
 */
export function isRequestExpired(request: RecipientPaymentRequest): boolean {
  return request.status === 'PENDING' && new Date() > request.expiresAt;
}

/**
 * Calcula o tempo restante para expiração em milissegundos
 */
export function getTimeUntilExpiration(request: RecipientPaymentRequest): number {
  if (request.status !== 'PENDING') return 0;
  const now = new Date();
  const diff = request.expiresAt.getTime() - now.getTime();
  return Math.max(0, diff);
}
