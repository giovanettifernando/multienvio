// platform/integrations/total-express/constants.ts
import 'server-only';

// ============================================================================
// URLs Base
// NOTE: Total Express uses the same endpoints for all environments;
// sandbox testing uses test credentials, not a separate base URL.
// ============================================================================

export const TE_API_BASE = 'https://apis.totalexpress.com.br';
export const TE_SOAP_BASE = 'https://edi.totalexpress.com.br';

// ============================================================================
// Endpoints
// ============================================================================

export const TE_ENDPOINTS = {
  /** SOAP: Cálculo de Frete v2.0 */
  calcFrete: '/webservice_calculo_frete_v2.php',
  /** REST: Smart Label v3.5 — criação de pedido */
  smartLabel: '/ics-edi-lv/v1/coleta/smartlabel/registrar',
  /** REST: Status de Entrega v1.0 — rastreamento */
  tracking: '/ics-tracking-encomenda-lv/v1/tracking',
} as const;

// ============================================================================
// Tipos de Serviço
// IMPORTANT: Verify these codes match the Cálculo de Frete v2.0 PDF exactly.
// ============================================================================

export const TE_SERVICE_TYPES = {
  /** Expresso — entrega em 1-2 dias úteis */
  EXP: 'EXP',
  /** Especial/Econômico — entrega em 3-5 dias úteis */
  ESP: 'ESP',
  /** Premium — serviço diferenciado */
  PRM: 'PRM',
  /** Standard — padrão */
  STD: 'STD',
} as const;

export type TEServiceType = (typeof TE_SERVICE_TYPES)[keyof typeof TE_SERVICE_TYPES];

export const TE_SERVICE_LABELS: Record<TEServiceType, string> = {
  EXP: 'Total Express Expresso',
  ESP: 'Total Express Econômico',
  PRM: 'Total Express Premium',
  STD: 'Total Express Standard',
};

// ============================================================================
// Tipo de Entrega (Smart Label)
// ============================================================================

export const TE_DELIVERY_TYPES = {
  /** Entrega domiciliar padrão */
  NORMAL: 'D',
} as const;

// ============================================================================
// Limites de Volumes
// Adjust these if the PDF specifies different limits.
// ============================================================================

export const TE_VOLUME_RULES = {
  /** Peso máximo real em kg */
  MAX_PESO_KG: 30,
  /** Maior lado máximo em cm */
  MAX_LADO_CM: 70,
  /** Soma dos lados máxima em cm */
  MAX_SOMA_LADOS_CM: 200,
  /** Fator de cubagem */
  CUBAGE_FACTOR: 6000,
} as const;

// ============================================================================
// Carrier Info
// ============================================================================

export const TE_CARRIER_SLUG = 'total-express';
export const TE_CARRIER_NAME = 'Total Express';
export const TE_DEFAULT_LOGO_URL = 'https://www.totalexpress.com.br/wp-content/uploads/2021/03/logo-total-express.png';

// ============================================================================
// SOAP Configuration
// These match the Cálculo de Frete v2.0 WSDL.
// IMPORTANT: If the SOAP calls fail with namespace errors, check the WSDL at:
// https://edi.totalexpress.com.br/webservice_calculo_frete_v2.php?wsdl
// and adjust TE_SOAP_NAMESPACE and TE_SOAP_ACTION_BASE below.
// ============================================================================

export const TE_SOAP_NAMESPACE = 'urn:webservice_calculo_frete_v2';
export const TE_SOAP_ACTION_BASE = 'urn:webservice_calculo_frete_v2#CalcFrete';
