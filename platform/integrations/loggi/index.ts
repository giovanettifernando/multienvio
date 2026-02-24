/**
 * Loggi - Barrel Exports
 */

// Constants
export {
  LOGGI_API_BASE,
  LOGGI_ENDPOINTS,
  LOGGI_FREIGHT_TYPES,
  LOGGI_PICKUP_TYPES,
  LOGGI_LABEL_RESPONSE_TYPES,
  LOGGI_LABEL_FORMATS,
  LOGGI_LABEL_LAYOUTS,
  LOGGI_ICMS,
  LOGGI_LIMITS,
  LOGGI_CARRIER_SLUG,
  LOGGI_CARRIER_NAME,
  LOGGI_DEFAULT_LOGO_URL,
} from './constants';

// Types
export type {
  LoggiConfig,
  LoggiTokenResponse,
  LoggiAuthTestResult,
  LoggiMoney,
  LoggiCorreiosAddress,
  LoggiLineAddress,
  LoggiAddress,
  LoggiQuotePackage,
  LoggiQuoteRequest,
  LoggiQuotation,
  LoggiQuoteResponse,
  LoggiShipmentRequest,
  LoggiShipmentResponse,
  LoggiShipmentResponsePackage,
  LoggiLabelRequest,
  LoggiLabelResponse,
  LoggiTrackingResponse,
  LoggiErrorResponse,
} from './types';
export { LoggiApiError, LoggiAuthError } from './types';

// Client
export {
  getLoggiConfigAsync,
  validateLoggiConfig,
  isLoggiConfigured,
  invalidateLoggiConfigCache,
  getLoggiConfigInfo,
  loggiFetch,
  testLoggiAuth,
  resetLoggiCircuitBreaker,
} from './client';

// Cotação
export { cotarLoggi, loggiMoneyToReais, centavosToLoggiMoney } from './cotacao';
export type { LoggiCotacaoInput } from './cotacao';

// Adapter
export {
  LOGGI_CARRIER_ID,
  isLoggiAvailableAsync,
  quoteFromLoggi,
  loggiQuotationToQuoteResults,
  isLoggiService,
  extractLoggiFreightType,
} from './adapter';
export type { LoggiQuoteResult } from './adapter';

// Volume Validator
export { loggiVolumeValidator, LoggiVolumeValidator, LOGGI_VOLUME_RULES } from './loggi-volume-validator';

// Shipment
export { createLoggiShipment } from './shipment';
export type { CreateLoggiShipmentInput } from './shipment';

// Label
export { printLoggiLabel } from './label';

// Tracking
export { getLoggiTracking } from './tracking';
export type { LoggiTrackingPackage, LoggiTrackingStatus } from './types';
