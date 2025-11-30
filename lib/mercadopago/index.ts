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
  MercadoPagoApiError,
} from './types';

export { MP_STATUS_MAP, MP_METHOD_MAP } from './types';

// Client
export {
  createPayment,
  getPaymentById,
  mapMercadoPagoStatus,
  mapMercadoPagoMethod,
  processPaymentData,
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
  CreateCustomerInput,
  MercadoPagoCustomer,
  CreateCardInput,
  MercadoPagoCard,
  CreatePaymentWithSavedCardInput,
} from './cards';
export {
  createCustomer,
  getCustomer,
  createCard,
  listCards,
  deleteCard,
  createPaymentWithSavedCard,
  mapMercadoPagoCardBrand,
} from './cards';
