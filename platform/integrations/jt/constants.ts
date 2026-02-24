import 'server-only';

/**
 * Constantes da integração J&T Express Brasil
 */

// ============================================================================
// URLs Base
// ============================================================================

export const JT_API_BASE = {
  sandbox: 'https://demoopenapi.jtjms-br.com',
  production: 'https://openapi.jtjms-br.com',
} as const;

/** URL base para o endpoint de cotação (pode diferir da URL principal) */
export const JT_COST_API_BASE = {
  sandbox: 'https://demoopenapi.jtjms-br.com',
  production: 'https://demogw.jtjms-br.com',
} as const;

// ============================================================================
// Endpoints
// ============================================================================

export const JT_ENDPOINTS = {
  /** Cotação de preço e prazo */
  getComCostAndTime: '/webopenplatformapi/api/spmComCost/getComCostAndTime',
  /** Criação de pedido */
  addOrder: '/webopenplatformapi/api/order/addOrder',
  /** Geração de etiqueta */
  printOrder: '/webopenplatformapi/api/order/printOrder',
} as const;

// ============================================================================
// Tipos de Produto / Serviço
// ============================================================================

export const JT_PRODUCT_TYPES = {
  /** Entrega padrão (normal express) */
  EZ: 'EZ',
  /** Entrega expressa */
  EXPRESS: 'express',
  /** Frete / Carga */
  STANDARD: 'standard',
  /** Normal express (alternativo) */
  CRD: 'CRD',
} as const;

export const JT_ORDER_TYPE = {
  /** Faturamento mensal */
  MONTHLY_BILLING: '2',
} as const;

export const JT_SERVICE_TYPE = {
  /** Modelo operação padrão */
  STANDARD: '02',
} as const;

export const JT_DELIVERY_TYPE = {
  /** Entrega domiciliar */
  HOME: '03',
} as const;

// ============================================================================
// Classificação de Mercadorias
// ============================================================================

export const JT_GOODS_TYPES = {
  DOCUMENTS: 'bm000001',
  ELECTRONICS: 'bm000002',
  HOUSEHOLD: 'bm000003',
  FOOD: 'bm000004',
  CLOTHING: 'bm000005',
  OTHER: 'bm000006',
  PERISHABLE: 'bm000007',
  FRAGILE: 'bm000008',
  LIQUID: 'bm000009',
} as const;

// ============================================================================
// Limites
// ============================================================================

export const JT_LIMITS = {
  /** Peso máximo em kg */
  MAX_WEIGHT_KG: 30,
  /** Peso mínimo em kg */
  MIN_WEIGHT_KG: 0.01,
} as const;

// ============================================================================
// Autenticação
// ============================================================================

/** Salt fixo usado pela J&T na geração do hash de senha */
export const JT_PASSWORD_SALT = 'jadada236t2';

// ============================================================================
// Carrier Info
// ============================================================================

export const JT_CARRIER_SLUG = 'jt';
export const JT_CARRIER_NAME = 'J&T Express';
export const JT_DEFAULT_LOGO_URL = 'https://www.jtexpress.com.br/newassets/images/logo.png';
