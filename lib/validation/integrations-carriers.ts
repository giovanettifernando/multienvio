import { z } from 'zod';

/**
 * Validation schemas for carrier integrations
 */

// Enums
export const integrationEnvironmentSchema = z.enum(['SANDBOX', 'PRODUCTION']);
export const integrationStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ERROR', 'TESTING']);
export const authTypeSchema = z.enum(['API_KEY', 'OAUTH2', 'BASIC', 'BEARER', 'SIGNED_HEADER', 'CUSTOM']);
export const healthStatusSchema = z.enum(['HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN']);

export type IntegrationEnvironment = z.infer<typeof integrationEnvironmentSchema>;
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
export type AuthType = z.infer<typeof authTypeSchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;

// Carrier schemas
export const createCarrierSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  status: integrationStatusSchema.default('ACTIVE'),
  environment: integrationEnvironmentSchema.default('PRODUCTION'),
  baseUrl: z.string().url('URL inválida').nullable().optional(),
  timeout: z.coerce.number().int().min(1000).max(300000).default(30000),
  maxRetries: z.coerce.number().int().min(0).max(10).default(3),
  logoUrl: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const updateCarrierSchema = createCarrierSchema.partial();

export type CreateCarrierInput = z.infer<typeof createCarrierSchema>;
export type UpdateCarrierInput = z.infer<typeof updateCarrierSchema>;

// Carrier Service schemas
export const createCarrierServiceSchema = z.object({
  carrierId: z.string().cuid(),
  serviceId: z.string().min(1, 'Service ID é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['express', 'economic', 'reverse']),
  isActive: z.boolean().default(true),
  minDays: z.coerce.number().int().min(0).nullable().optional(),
  maxDays: z.coerce.number().int().min(0).nullable().optional(),
  requiresInsurance: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updateCarrierServiceSchema = createCarrierServiceSchema.omit({ carrierId: true }).partial();

export type CreateCarrierServiceInput = z.infer<typeof createCarrierServiceSchema>;
export type UpdateCarrierServiceInput = z.infer<typeof updateCarrierServiceSchema>;

// Carrier Endpoint schemas
export const createCarrierEndpointSchema = z.object({
  carrierId: z.string().cuid(),
  operation: z.enum(['quote', 'create_order', 'cancel', 'label', 'tracking']),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  path: z.string().min(1, 'Path é obrigatório'),
  timeout: z.coerce.number().int().min(1000).max(300000).nullable().optional(),
  retryable: z.boolean().default(true),
  requestMapping: z.record(z.string(), z.unknown()).nullable().optional(),
  responseMapping: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updateCarrierEndpointSchema = createCarrierEndpointSchema.omit({ carrierId: true }).partial();

export type CreateCarrierEndpointInput = z.infer<typeof createCarrierEndpointSchema>;
export type UpdateCarrierEndpointInput = z.infer<typeof updateCarrierEndpointSchema>;

// Carrier Credential schemas
export const createCarrierCredentialSchema = z.object({
  carrierId: z.string().cuid(),
  environment: integrationEnvironmentSchema,
  authType: authTypeSchema,
  // API Key
  apiKey: z.string().nullable().optional(),
  // OAuth2
  clientId: z.string().nullable().optional(),
  clientSecret: z.string().nullable().optional(),
  tokenUrl: z.string().url().nullable().optional(),
  scope: z.string().nullable().optional(),
  accessToken: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  // Basic Auth
  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  // Bearer Token
  token: z.string().nullable().optional(),
  // Custom Headers
  customHeaders: z.record(z.string(), z.string()).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateCarrierCredentialSchema = createCarrierCredentialSchema.omit({ carrierId: true }).partial();

export type CreateCarrierCredentialInput = z.infer<typeof createCarrierCredentialSchema>;
export type UpdateCarrierCredentialInput = z.infer<typeof updateCarrierCredentialSchema>;

// Carrier Pricing Rule schemas
export const createCarrierPricingRuleSchema = z.object({
  carrierId: z.string().cuid(),
  name: z.string().min(1, 'Nome é obrigatório'),
  serviceId: z.string().nullable().optional(),
  originStates: z.string().nullable().optional(), // Comma-separated UFs
  destStates: z.string().nullable().optional(),
  minWeight: z.coerce.number().min(0).nullable().optional(),
  maxWeight: z.coerce.number().min(0).nullable().optional(),
  basePriceCents: z.coerce.number().int().min(0).nullable().optional(),
  pricePerKg: z.coerce.number().min(0).nullable().optional(),
  insurancePercent: z.coerce.number().min(0).max(100).nullable().optional(),
  additionalFees: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().default(0),
});

export const updateCarrierPricingRuleSchema = createCarrierPricingRuleSchema.omit({ carrierId: true }).partial();

export type CreateCarrierPricingRuleInput = z.infer<typeof createCarrierPricingRuleSchema>;
export type UpdateCarrierPricingRuleInput = z.infer<typeof updateCarrierPricingRuleSchema>;

// Test connection schema
export const testCarrierConnectionSchema = z.object({
  carrierId: z.string().cuid(),
  environment: integrationEnvironmentSchema,
});

export type TestCarrierConnectionInput = z.infer<typeof testCarrierConnectionSchema>;

// List carriers query
export const listCarriersQuerySchema = z.object({
  status: integrationStatusSchema.optional(),
  environment: integrationEnvironmentSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListCarriersQuery = z.infer<typeof listCarriersQuerySchema>;

// Webhook processing schemas
export const processCarrierWebhookSchema = z.object({
  carrierId: z.string().cuid(),
  eventType: z.string().min(1),
  externalId: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()),
  signature: z.string().nullable().optional(),
});

export type ProcessCarrierWebhookInput = z.infer<typeof processCarrierWebhookSchema>;

// Health check schema
export const recordCarrierHealthCheckSchema = z.object({
  carrierId: z.string().cuid(),
  status: healthStatusSchema,
  responseTime: z.number().int().min(0).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  successRate: z.number().min(0).max(100).nullable().optional(),
  avgLatency: z.number().int().min(0).nullable().optional(),
});

export type RecordCarrierHealthCheckInput = z.infer<typeof recordCarrierHealthCheckSchema>;

// Business rules validation
export const validateCarrierRules = {
  /**
   * Validates if credential fields are present based on auth type
   */
  validateCredentialFields(authType: AuthType, data: CreateCarrierCredentialInput): boolean {
    switch (authType) {
      case 'API_KEY':
        return !!data.apiKey;
      case 'OAUTH2':
        return !!data.clientId && !!data.clientSecret && !!data.tokenUrl;
      case 'BASIC':
        return !!data.username && !!data.password;
      case 'BEARER':
        return !!data.token;
      case 'SIGNED_HEADER':
      case 'CUSTOM':
        return !!data.customHeaders;
      default:
        return false;
    }
  },

  /**
   * Validates pricing rule consistency
   */
  validatePricingRule(rule: CreateCarrierPricingRuleInput): { valid: boolean; error?: string } {
    if (rule.minWeight && rule.maxWeight && rule.minWeight > rule.maxWeight) {
      return { valid: false, error: 'Peso mínimo não pode ser maior que peso máximo' };
    }
    return { valid: true };
  },

  /**
   * Validates webhook retry policy
   */
  shouldRetryWebhook(retryCount: number, maxRetries: number): boolean {
    return retryCount < maxRetries;
  },

  /**
   * Calculates next retry time with exponential backoff
   */
  calculateNextRetry(retryCount: number): Date {
    const baseDelay = 60000; // 1 minute
    const maxDelay = 3600000; // 1 hour
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    return new Date(Date.now() + delay);
  },
};

// Helper functions for field masking
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '****';
  return `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`;
}

 
export function maskSecret(_value?: string): string {
  return '****** (hidden)';
}

export function maskCredentials(credential: unknown): unknown {
  const cred = credential as Record<string, unknown>;
  return {
    ...cred,
    apiKey: cred.apiKey ? maskApiKey(cred.apiKey as string) : null,
    clientSecret: cred.clientSecret ? maskSecret(cred.clientSecret as string) : null,
    password: cred.password ? maskSecret(cred.password as string) : null,
    token: cred.token ? maskSecret(cred.token as string) : null,
    accessToken: cred.accessToken ? maskSecret(cred.accessToken as string) : null,
    refreshToken: cred.refreshToken ? maskSecret(cred.refreshToken as string) : null,
  };
}
