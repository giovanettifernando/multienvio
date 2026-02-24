import 'server-only';

/**
 * Constantes da integração Loggi
 */

// ============================================================================
// URLs Base
// ============================================================================

export const LOGGI_API_BASE = {
  sandbox: 'https://stg.api.loggi.com',
  production: 'https://api.loggi.com',
} as const;

// ============================================================================
// Endpoints
// ============================================================================

export const LOGGI_ENDPOINTS = {
  /** Autenticação OAuth2 V2 */
  authV2: '/v2/oauth2/token',
  /** Cotação de frete */
  quote: '/v1/companies/{companyId}/quotations',
  /** Criação de shipment assíncrono */
  asyncShipment: '/v1/companies/{companyId}/async-shipments',
  /** Geração de etiqueta */
  label: '/v1/companies/{companyId}/labels',
  /** Rastreamento */
  tracking: '/v1/companies/{companyId}/packages/{trackingCode}/tracking',
} as const;

// ============================================================================
// Tipos de Frete
// ============================================================================

export const LOGGI_FREIGHT_TYPES = {
  EXPRESS: 'FREIGHT_TYPE_EXPRESS',
  ECONOMIC: 'FREIGHT_TYPE_ECONOMIC',
} as const;

export const LOGGI_PICKUP_TYPES = {
  SPOT: 'PICKUP_TYPE_SPOT',
  DEDICATED: 'PICKUP_TYPE_DEDICATED',
  MILK_RUN: 'PICKUP_TYPE_MILK_RUN',
  DROP_OFF: 'PICKUP_TYPE_DROP_OFF',
} as const;

// ============================================================================
// Etiqueta
// ============================================================================

export const LOGGI_LABEL_RESPONSE_TYPES = {
  BASE64: 'LABEL_RESPONSE_TYPE_BASE_64',
  URL: 'LABEL_RESPONSE_TYPE_URL',
} as const;

export const LOGGI_LABEL_FORMATS = {
  PDF: 'LABEL_FORMAT_PDF',
} as const;

export const LOGGI_LABEL_LAYOUTS = {
  A4: 'LABEL_LAYOUT_A4',
  A6: 'LABEL_LAYOUT_A6',
} as const;

// ============================================================================
// ICMS
// ============================================================================

export const LOGGI_ICMS = {
  TAXED: 'ICMS_TAXED',
  NOT_TAXED: 'ICMS_NOT_TAXED',
  FREE: 'ICMS_FREE',
} as const;

// ============================================================================
// Limites
// ============================================================================

export const LOGGI_LIMITS = {
  /** Peso máximo em gramas */
  MAX_WEIGHT_G: 30000,
  /** Peso máximo em kg */
  MAX_WEIGHT_KG: 30,
  /** Dimensão máxima por lado em cm */
  MAX_DIMENSION_CM: 100,
} as const;

// ============================================================================
// Carrier Info
// ============================================================================

export const LOGGI_CARRIER_SLUG = 'loggi';
export const LOGGI_CARRIER_NAME = 'Loggi';
export const LOGGI_DEFAULT_LOGO_URL = 'https://images.loggi.com/favicon.ico';
