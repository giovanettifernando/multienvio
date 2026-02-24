/**
 * J&T Express Brasil - Barrel Exports
 */

// Constants
export {
  JT_API_BASE,
  JT_COST_API_BASE,
  JT_ENDPOINTS,
  JT_PRODUCT_TYPES,
  JT_ORDER_TYPE,
  JT_SERVICE_TYPE,
  JT_DELIVERY_TYPE,
  JT_GOODS_TYPES,
  JT_LIMITS,
  JT_PASSWORD_SALT,
  JT_CARRIER_SLUG,
  JT_CARRIER_NAME,
  JT_DEFAULT_LOGO_URL,
} from './constants';

// Types
export type {
  JTConfig,
  JTCostTimeRequest,
  JTCostTimeData,
  JTCostTimeResponse,
  JTSenderReceiver,
  JTOrderItem,
  JTAddOrderRequest,
  JTAddOrderResponse,
  JTPrintOrderRequest,
  JTPrintOrderResponse,
  JTApiResponse,
} from './types';
export { JTApiError, JTAuthError } from './types';

// Client
export {
  getJTConfig,
  getJTConfigAsync,
  validateJTConfig,
  isJTConfigured,
  invalidateJTConfigCache,
  jtFetch,
  testJTAuth,
  getJTConfigInfo,
  resetJTCircuitBreaker,
  generatePasswordHash,
  generateBodyDigest,
  generateHeaderDigest,
} from './client';
export type { JTAuthTestResult } from './client';

// Cotação
export { cotarJT, cotarJTSimples } from './cotacao';
export type { JTCotacaoInput } from './cotacao';

// Adapter
export {
  JT_CARRIER_ID,
  isJTAvailableAsync,
  quoteFromJT,
  jtCotacaoToQuoteResult,
  isJTService,
  extractJTProductType,
} from './adapter';
export type { JTQuoteResult } from './adapter';

// Volume Validator
export { jtVolumeValidator, JTVolumeValidator, JT_VOLUME_RULES } from './jt-volume-validator';

// Order
export { createJTOrder } from './order';
export type { CreateJTOrderInput } from './order';

// Label
export { printJTLabel } from './label';
