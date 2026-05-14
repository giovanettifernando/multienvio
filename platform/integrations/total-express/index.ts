// Constants
export {
  TE_API_BASE,
  TE_SOAP_BASE,
  TE_ENDPOINTS,
  TE_SERVICE_TYPES,
  TE_SERVICE_LABELS,
  TE_DELIVERY_TYPES,
  TE_VOLUME_RULES,
  TE_CARRIER_SLUG,
  TE_CARRIER_NAME,
  TE_DEFAULT_LOGO_URL,
  TE_SOAP_NAMESPACE,
  TE_SOAP_ACTION_BASE,
} from './constants';
export type { TEServiceType, TEDeliveryType } from './constants';

// Types
export type {
  TEConfig,
  TECotacaoInput,
  TECotacaoResult,
  TEAddress,
  TEVolume,
  TENotaFiscal,
  TESmartLabelRequest,
  TESmartLabelVolumeResponse,
  TESmartLabelResponse,
  TETrackingEvent,
  TETrackingPackage,
  TETrackingResponse,
  TEAuthTestResult,
} from './types';
export { TEApiError, TEAuthError } from './types';

// Client
export {
  getTEConfigAsync,
  validateTEConfig,
  invalidateTEConfigCache,
  teFetch,
  teSoapCalcFrete,
  testTEAuth,
} from './client';
export type { TESoapParams, TESoapResult } from './client';

// Cotação
export { cotarTE } from './cotacao';

// Order
export { createTEOrder } from './order';
export type { CreateTEOrderInput } from './order';

// Tracking
export { getTETracking } from './tracking';

// Adapter
export {
  TE_CARRIER_ID,
  isTotalExpressAvailableAsync,
  quoteFromTotalExpress,
  isTEService,
} from './adapter';
export type { TEQuoteResult } from './adapter';

// Volume Validator
export {
  totalExpressVolumeValidator,
  TotalExpressVolumeValidator,
  computeTEVolumeValues,
} from './total-express-volume-validator';
