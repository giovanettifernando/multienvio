/**
 * Environment variable validation using Zod
 *
 * Call validateEnv() at application startup to ensure required vars are set.
 * Uses Zod for type-safe validation and coercion.
 *
 * Categories:
 * - CRITICAL: App crashes without these (DATABASE_URL, secrets)
 * - REQUIRED: Core functionality depends on these (JWT secrets)
 * - OPTIONAL: Enhanced features, with sensible defaults
 */

import { z } from 'zod';
import { logger } from '@/platform/logging/logger';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/**
 * Critical environment variables - app will not start without these
 */
const criticalEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'PostgreSQL connection string is required'),
  NEXTAUTH_SECRET: z.string().min(16, 'Must be at least 16 characters for security'),
  JWT_SECRET: z.string().min(16, 'Must be at least 16 characters for security'),
  ADMIN_JWT_SECRET: z.string().min(16, 'Must be at least 16 characters for security'),
  COLLECTOR_JWT_SECRET: z.string().min(16, 'Must be at least 16 characters for security'),
});

/**
 * Optional environment variables with defaults
 */
const optionalEnvSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Session TTL
  CLIENT_SESSION_TTL_DAYS: z.coerce.number().positive().default(7),
  ADMIN_SESSION_TTL_MINUTES: z.coerce.number().positive().default(60),

  // Database pool
  DB_POOL_MAX: z.coerce.number().positive().default(20),
  DB_POOL_MIN: z.coerce.number().nonnegative().default(2),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().positive().default(10000),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().positive().default(30000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().positive().default(60000),
  DB_APPLICATION_NAME: z.string().default('enviolegal-app'),
  DB_CONNECT_RETRIES: z.coerce.number().nonnegative().default(5),
  DB_CONNECT_BACKOFF_MS: z.coerce.number().positive().default(500),
  SKIP_MIGRATION_CHECK: z.enum(['true', 'false', '1', '0']).optional(),

  // Redis (optional - for rate limiting)
  REDIS_URL: z.string().url().optional(),

  // Mercado Pago (optional - for payments)
  MP_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MP_PUBLIC_KEY: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  MP_SANDBOX_MODE: z.enum(['true', 'false']).optional(),

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Correios (optional - for shipping)
  CORREIOS_USER: z.string().optional(),
  CORREIOS_PASSWORD: z.string().optional(),
  CORREIOS_CARTAO_POSTAGEM: z.string().optional(),
  CORREIOS_CONTRATO: z.string().optional(),
  CORREIOS_DR: z.string().optional(),
  CORREIOS_API_BASE: z.string().url().optional(),
  CORREIOS_API_KEY: z.string().optional(),
  CORREIOS_ENVIRONMENT: z.enum(['producao', 'homologacao']).optional(),

  // Email
  EMAIL_PUBLIC_URL: z.string().url().optional(),

  // Uploads
  COLLECTOR_UPLOAD_DIR: z.string().default('./uploads/collector'),
  SUPPORT_UPLOAD_DIR: z.string().default('./uploads/support'),
  EXPENSE_UPLOAD_DIR: z.string().default('./uploads/expenses'),

  // Security
  ENCRYPTION_KEY: z.string().min(32).optional(),
  CRON_SECRET: z.string().optional(),
  TRUST_PROXY: z.enum(['true', 'false', '1', '0']).optional(),

  // Payment gateway
  PAYMENT_GATEWAY_ENABLED: z.enum(['true', 'false']).optional(),
  PAYMENT_GATEWAY_URL: z.string().url().optional(),

  // External APIs
  FIPE_BASE_URL: z.string().url().optional(),
  FIPE_SUBSCRIPTION_TOKEN: z.string().optional(),
});

// Combined schema
const envSchema = criticalEnvSchema.merge(optionalEnvSchema);

// Type for validated environment
export type ValidatedEnv = z.infer<typeof envSchema>;

// ============================================================================
// VALIDATION STATE
// ============================================================================

let validated = false;
let cachedEnv: ValidatedEnv | null = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if we're in a build/static generation phase
 * During build, env vars may not be fully available
 */
function isBuildOrStaticPhase(): boolean {
  const phase = process.env.NEXT_PHASE;
  if (phase && (
    phase.includes('build') ||
    phase.includes('export') ||
    phase.includes('generate')
  )) {
    return true;
  }

  // During Next.js build workers without full env vars
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET) {
    return true;
  }

  return false;
}

/**
 * Format Zod errors for logging
 */
function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
  env?: ValidatedEnv;
}

/**
 * Validate required environment variables
 *
 * - Logs warnings for missing optional vars
 * - Throws only at actual runtime in production (not during build)
 * - Caches result for subsequent calls
 */
export function validateEnv(): ValidationResult {
  if (validated && cachedEnv) {
    return { valid: true, missing: [], warnings: [], env: cachedEnv };
  }

  const missing: string[] = [];
  const warnings: string[] = [];

  // During build phase, only do basic checks
  if (isBuildOrStaticPhase()) {
    validated = true;
    return { valid: true, missing: [], warnings: ['Skipped validation during build phase'] };
  }

  // Validate critical vars first
  const criticalResult = criticalEnvSchema.safeParse(process.env);

  if (!criticalResult.success) {
    const errors = formatZodErrors(criticalResult.error);
    missing.push(...errors);

    const errorMessage = `Missing or invalid critical environment variables:\n${errors.map((e) => `  - ${e}`).join('\n')}`;

    // In production, throw immediately for critical vars
    if (process.env.NODE_ENV === 'production') {
      logger.error({ event: 'env_validation_failed', errors }, 'FATAL: Critical environment variables missing');
      throw new Error(`SECURITY ERROR: ${errorMessage}`);
    } else {
      // In development, log error but continue
      logger.error({ event: 'env_validation_failed', errors }, errorMessage);
    }
  }

  // Validate optional vars (collect warnings, don't fail)
  const optionalResult = optionalEnvSchema.safeParse(process.env);

  if (!optionalResult.success) {
    const optionalErrors = formatZodErrors(optionalResult.error);
    warnings.push(...optionalErrors);

    if (process.env.NODE_ENV === 'development') {
      logger.warn({
        event: 'env_validation_warnings',
        warnings: optionalErrors
      }, 'Some optional environment variables have issues');
    }
  }

  // Full validation for caching
  const fullResult = envSchema.safeParse(process.env);

  if (fullResult.success) {
    cachedEnv = fullResult.data;
  }

  validated = true;

  // Log feature availability based on configuration
  logFeatureAvailability();

  return {
    valid: missing.length === 0,
    missing,
    warnings,
    env: cachedEnv ?? undefined,
  };
}

/**
 * Log which features are enabled based on env configuration
 */
function logFeatureAvailability(): void {
  const features: Record<string, boolean> = {
    payments_mercadopago: isEnvConfigured('MP_ACCESS_TOKEN') || isEnvConfigured('MERCADOPAGO_ACCESS_TOKEN'),
    shipping_correios: isEnvConfigured('CORREIOS_USER') && isEnvConfigured('CORREIOS_PASSWORD'),
    oauth_google: isEnvConfigured('GOOGLE_CLIENT_ID') && isEnvConfigured('GOOGLE_CLIENT_SECRET'),
    rate_limiting_redis: isEnvConfigured('REDIS_URL'),
    encryption: isEnvConfigured('ENCRYPTION_KEY'),
  };

  const enabled = Object.entries(features)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const disabled = Object.entries(features)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (process.env.NODE_ENV === 'development') {
    logger.info({
      event: 'env_features',
      enabled,
      disabled
    }, 'Feature availability based on environment');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a specific env var is configured (non-empty)
 */
export function isEnvConfigured(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.trim() !== '');
}

/**
 * Get env var with fallback
 * @throws if var is not set and no fallback provided
 */
export function getEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value && value.trim() !== '') {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Environment variable ${name} is not configured and no fallback provided`);
}

/**
 * Check if required integrations are configured
 */
export const integrations = {
  isMercadoPagoConfigured(): boolean {
    return isEnvConfigured('MP_ACCESS_TOKEN') || isEnvConfigured('MERCADOPAGO_ACCESS_TOKEN');
  },

  isCorreiosConfigured(): boolean {
    return isEnvConfigured('CORREIOS_USER') &&
           isEnvConfigured('CORREIOS_PASSWORD') &&
           isEnvConfigured('CORREIOS_CARTAO_POSTAGEM');
  },

  isGoogleOAuthConfigured(): boolean {
    return isEnvConfigured('GOOGLE_CLIENT_ID') && isEnvConfigured('GOOGLE_CLIENT_SECRET');
  },

  isRedisConfigured(): boolean {
    return isEnvConfigured('REDIS_URL');
  },

  isEncryptionConfigured(): boolean {
    return isEnvConfigured('ENCRYPTION_KEY');
  },
};
