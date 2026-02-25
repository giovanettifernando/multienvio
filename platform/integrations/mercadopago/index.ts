/**
 * Mercado Pago Integration
 *
 * Exportações centralizadas de todos os módulos
 */

// Config
export {
  getMercadoPagoConfig,
  invalidateConfigCache,
  isMercadoPagoConfigured,
  getMercadoPagoPublicKey,
} from './config';

// Types
export type {
  MercadoPagoConfig,
  CreatePaymentInput,
  MercadoPagoPaymentResponse,
  ProcessedPaymentData,
  MercadoPagoWebhookPayload,
  WebhookHeaders,
} from './types';

export { STATUS_DETAIL_MESSAGES, getStatusDetailMessage } from './types';

// Client
export {
  createPayment,
  getPaymentById,
  mapMercadoPagoStatus,
  mapMercadoPagoMethod,
  processPaymentData,
  refundPayment,
} from './client';

// Payments
export type { CreatePaymentResult } from './payments';
export { createPaymentWithTracking, updatePaymentFromMercadoPago } from './payments';

// Webhooks
export { validateWebhookSignature, processWebhook, retryFailedWebhooks } from './webhooks';

// PIX Monitor
export type { PixMonitorResult } from './pix-monitor';
export {
  monitorPendingPixPayments,
  cleanupOldPendingPix,
  getPendingPixPayments,
  processPixPayment,
  isPixExpired,
  recordFailedPixInWallet,
} from './pix-monitor';

// Cards & Customers
export type {
  CreateCardInput,
  MercadoPagoCard,
  CreatePaymentWithSavedCardInput,
} from './cards';
export {
  createCard,
  listCards,
  deleteCard,
  createPaymentWithSavedCard,
} from './cards';
