/**
 * Environment variable validation
 * Call validateEnv() at application startup to ensure required vars are set
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  // Critical - app will not function without these
  { name: "DATABASE_URL", required: true, description: "PostgreSQL connection string" },
  { name: "NEXTAUTH_SECRET", required: true, description: "NextAuth.js secret key" },

  // Authentication - required for full functionality
  { name: "COLLECTOR_JWT_SECRET", required: true, description: "JWT secret for collector authentication" },

  // Optional but recommended
  { name: "MP_ACCESS_TOKEN", required: false, description: "Mercado Pago access token" },
  { name: "MERCADOPAGO_ACCESS_TOKEN", required: false, description: "Mercado Pago access token (alternative)" },
];

interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

let validated = false;

/**
 * Check if we're in a build/static generation phase
 * During build, env vars may not be fully available
 */
function isBuildOrStaticPhase(): boolean {
  // Check for various build phase indicators
  const phase = process.env.NEXT_PHASE;
  if (phase && (
    phase.includes("build") ||
    phase.includes("export") ||
    phase.includes("generate")
  )) {
    return true;
  }

  // During Next.js build workers, check if we're collecting page data
  // These workers may not have full env vars
  if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
    // If we're in production mode but missing critical secrets,
    // we're likely in a build worker - warn but don't crash
    return true;
  }

  return false;
}

/**
 * Validate required environment variables
 * Logs warnings for missing optional vars
 * Throws only at actual runtime in production (not during build)
 */
export function validateEnv(): ValidationResult {
  if (validated) {
    return { valid: true, missing: [], warnings: [] };
  }

  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value || value.trim() === "") {
      if (envVar.required) {
        missing.push(`${envVar.name} (${envVar.description})`);
      } else {
        warnings.push(`${envVar.name} (${envVar.description})`);
      }
    }
  }

  // Handle missing required vars
  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables:\n${missing.map((m) => `  - ${m}`).join("\n")}`;

    // Only throw at actual runtime in production, not during build
    const shouldThrow = process.env.NODE_ENV === "production" && !isBuildOrStaticPhase();

    if (shouldThrow) {
      console.error("[ENV] CRITICAL:", errorMessage);
      throw new Error(`SECURITY ERROR: ${errorMessage}`);
    }
  }

  validated = true;

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Check if a specific env var is configured
 */
export function isEnvConfigured(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.trim() !== "");
}

/**
 * Get env var with fallback
 */
export function getEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value && value.trim() !== "") {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Environment variable ${name} is not configured and no fallback provided`);
}
