export type CarrierService = 'quote' | 'label' | 'tracking';

export interface Carrier {
  id: string;
  name: string;
  slug: string;
  website?: string;
  logoUrl?: string;
  enabled: boolean;
  services: CarrierService[];
  updatedAt: string;
}

export type Environment = 'sandbox' | 'production';

export interface CarrierApi {
  id: string;
  carrierId: string;
  environment: Environment;
  quoteUrl?: string;
  labelUrl?: string;
  trackingUrl?: string;
  active: boolean;
  notes?: string;
  updatedAt: string;
}

export type AuthFieldType = 'text' | 'password' | 'token';

export interface AuthField {
  key: string;
  label: string;
  type: AuthFieldType;
  value?: string;
  masked?: boolean;
}

export interface AuthConfig {
  id: string;
  carrierId: string;
  fields: AuthField[];
  updatedAt: string;
}

export type PaymentGatewayProvider = 'mercadoPago';

export interface PaymentGatewayConfig {
  provider: PaymentGatewayProvider;
  publicKey?: string;
  accessToken?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  active: boolean;
  updatedAt: string;
}

export type HealthStatus = 'up' | 'down';

export interface IntegrationHealth {
  carrierId: string;
  status: HealthStatus;
  latencyMs?: number;
  lastCheckedAt?: string;
  message?: string;
}

// Form types
export interface CarrierFormData {
  name: string;
  slug: string;
  website?: string;
  logoUrl?: string;
  enabled?: boolean;
  services?: CarrierService[];
}

export interface ApiFormData {
  carrierId: string;
  environment: Environment;
  quoteUrl?: string;
  labelUrl?: string;
  trackingUrl?: string;
  active?: boolean;
  notes?: string;
}

export interface AuthFormData {
  carrierId: string;
  fields: AuthField[];
}

export interface PaymentGatewayFormData {
  provider: PaymentGatewayProvider;
  publicKey?: string;
  accessToken?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  active?: boolean;
}
