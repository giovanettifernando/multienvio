/**
 * Tipos dos payloads de cada job BullMQ
 *
 * Cada fila tem seu tipo de payload bem definido para type-safety.
 */

// ============================================================================
// Tracking
// ============================================================================

export interface TrackingJobPayload {
  shipmentId: string;
  trackingCode: string;
  carrier: 'correios' | 'jt' | 'loggi';
}

// ============================================================================
// Webhooks
// ============================================================================

export interface MercadoPagoWebhookJobPayload {
  /** ID do webhook record no banco (já criado com status PENDING) */
  webhookRecordId: string;
  /** Payload original do MP (já validado HMAC) */
  payload: {
    id?: string | number;
    live_mode?: boolean;
    type?: string;
    date_created?: string;
    user_id?: string | number;
    api_version?: string;
    action?: string;
    data?: {
      id?: string | number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

// ============================================================================
// Pagamentos
// ============================================================================

export interface PixMonitorJobPayload {
  /** Sem payload — job repeatable que busca do DB */
  trigger: 'scheduled' | 'manual';
}

export interface RecipientPaymentExpirationJobPayload {
  /** Sem payload — job repeatable que busca do DB */
  trigger: 'scheduled' | 'manual';
}

// ============================================================================
// Email
// ============================================================================

export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Identificador para deduplicação (ex: "verification:userId") */
  deduplicationKey?: string;
}

// ============================================================================
// Shipment (Fase 3 — Checkout assíncrono)
// ============================================================================

export interface ShipmentCreateJobPayload {
  shipmentId: string;
  userId: string;
  carrier: string;
  service: string;
  declaredValue: number;
  /** Status alvo após integração com transportadora */
  targetStatus: string;
  /** Dados da origem (não armazenados totalmente no shipment) */
  originAddress: {
    cep: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
}

export interface LabelGenerateJobPayload {
  shipmentId: string;
  carrier: string;
}

// ============================================================================
// Notificações in-app (Fase 3)
// ============================================================================

export interface NotificationStatusJobPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Reconciliação financeira (Fase 3)
// ============================================================================

export interface ReconciliationJobPayload {
  trigger: 'scheduled' | 'manual';
}

// ============================================================================
// Geração de PDF (fila única com discriminated union)
// ============================================================================

export interface PdfGenerateLabelPayload {
  documentType: 'label';
  documentId: string;
  userId: string;
  labelId: string;
}

export interface PdfGeneratePackagePayload {
  documentType: 'package';
  documentId: string;
  userId: string;
  packageId: string;
}

export interface PdfGenerateStatementPayload {
  documentType: 'statement';
  documentId: string;
  userId: string;
  walletId: string;
  dateFrom: string;
  dateTo: string;
  search?: string;
}

export interface PdfGenerateBatchLabelsPayload {
  documentType: 'batch_labels';
  documentId: string;
  userId: string;
  shipmentIds: string[];
}

export type PdfGenerateJobPayload =
  | PdfGenerateLabelPayload
  | PdfGeneratePackagePayload
  | PdfGenerateStatementPayload
  | PdfGenerateBatchLabelsPayload;

// ============================================================================
// Admin Sync (FIPE, Correios Agencies)
// ============================================================================

export interface FipeSyncJobPayload {
  /** Tipo de veículo a sincronizar */
  vehicleType: 'cars' | 'motorcycles' | 'trucks';
  /** Código de referência FIPE (mês atual) */
  referenceCode?: string;
  /** Se forçar atualização mesmo com dados recentes */
  forceUpdate?: boolean;
  /** ID da marca (quando sub-job por marca) */
  brandCode?: string;
  /** Modo: 'brands' busca marcas, 'models' busca modelos de uma marca */
  mode: 'brands' | 'models';
}

export interface CorreiosAgenciesSyncJobPayload {
  /** UF a sincronizar */
  uf: string;
  /** Se limpar registros antes de sincronizar */
  clearBefore?: boolean;
}

// ============================================================================
// Nomes das filas (constantes)
// ============================================================================

export const QUEUE_NAMES = {
  // Tracking por carrier
  TRACKING_CORREIOS: 'tracking.correios',
  TRACKING_JT: 'tracking.jt',
  TRACKING_LOGGI: 'tracking.loggi',

  // Tracking scheduler (enfileira jobs individuais)
  TRACKING_SCHEDULER: 'tracking.scheduler',

  // Webhooks
  WEBHOOK_MERCADOPAGO: 'webhook.mercadopago',

  // Pagamentos
  PAYMENT_PIX_MONITOR: 'payment.pix-monitor',
  PAYMENT_RECIPIENT_EXPIRATION: 'payment.recipient-expiration',

  // Email
  EMAIL: 'email',

  // Shipment (Fase 3)
  SHIPMENT_CREATE: 'shipment.create',
  LABEL_GENERATE: 'label.generate',

  // Notificações (Fase 3)
  NOTIFICATION_STATUS: 'notification.status',

  // Reconciliação (Fase 3)
  RECONCILIATION: 'admin.reconciliation',

  // Geração de PDF
  PDF_GENERATE: 'pdf.generate',

  // Admin sync
  FIPE_SYNC: 'admin.fipe-sync',
  CORREIOS_AGENCIES_SYNC: 'admin.correios-agencies-sync',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================================================
// Job priorities (menor = mais prioritário no BullMQ)
// ============================================================================

export const JOB_PRIORITY = {
  CRITICAL: 1,  // webhooks MP (dinheiro)
  HIGH: 2,      // PIX monitor, criação de envio
  MEDIUM: 5,    // tracking
  LOW: 10,      // notificações, reconciliação
} as const;
