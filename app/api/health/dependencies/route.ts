/**
 * Health check endpoint for all external dependencies
 * GET /api/health/dependencies - Checks database, external services, etc.
 */

import { withApiHandler } from "@/platform/api/handler";
import { pingDatabase, getPoolMetrics } from "@/platform/db/db";


interface DependencyStatus {
  name: string;
  status: "ok" | "degraded" | "unavailable";
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface HealthDependenciesResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  dependencies: DependencyStatus[];
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<DependencyStatus> {
  const start = Date.now();
  const poolMetrics = getPoolMetrics();

  try {
    await pingDatabase();
    const latencyMs = Date.now() - start;

    // Check if pool is under pressure (waiting > 0 means queries are queuing)
    const isUnderPressure = poolMetrics.waitingCount > 0;
    const poolUtilization = poolMetrics.totalCount / poolMetrics.maxPoolSize;

    return {
      name: "database",
      status: isUnderPressure || poolUtilization > 0.8 ? "degraded" : "ok",
      latencyMs,
      message: isUnderPressure ? `${poolMetrics.waitingCount} queries waiting` : undefined,
      details: {
        pool: poolMetrics,
        utilizationPercent: Math.round(poolUtilization * 100),
      },
    };
  } catch (error) {
    return {
      name: "database",
      status: "unavailable",
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Unknown error",
      details: { pool: poolMetrics },
    };
  }
}

/**
 * Check Pagar.me API connectivity (if configured)
 */
async function checkPagarme(): Promise<DependencyStatus> {
  const secretKey = process.env.PAGARME_SECRET_KEY;

  if (!secretKey) {
    return {
      name: "pagarme",
      status: "degraded",
      message: "Secret key not configured",
    };
  }

  const start = Date.now();
  try {
    // Simple API call to check connectivity — a 401 means the API is reachable
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://api.pagar.me/core/v5", {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // 401 = API is up but unauthenticated (expected without auth header)
    if (response.ok || response.status === 401 || response.status === 404) {
      return {
        name: "pagarme",
        status: "ok",
        latencyMs: Date.now() - start,
      };
    }

    return {
      name: "pagarme",
      status: "degraded",
      latencyMs: Date.now() - start,
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: "pagarme",
      status: "unavailable",
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Check environment variables are properly configured
 */
function checkEnvironment(): DependencyStatus {
  const requiredVars = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length === 0) {
    return {
      name: "environment",
      status: "ok",
    };
  }

  return {
    name: "environment",
    status: "degraded",
    message: `Missing: ${missingVars.join(", ")}`,
  };
}

export const GET = withApiHandler<HealthDependenciesResponse>(async ({ logger }) => {
  const timestamp = new Date().toISOString();

  // Run all checks in parallel
  const [database, pagarme] = await Promise.all([
    checkDatabase(),
    checkPagarme(),
  ]);

  const environment = checkEnvironment();

  const dependencies: DependencyStatus[] = [
    database,
    pagarme,
    environment,
  ];

  // Determine overall status
  const hasUnavailable = dependencies.some((d) => d.status === "unavailable");
  const hasDegraded = dependencies.some((d) => d.status === "degraded");

  let overallStatus: "healthy" | "degraded" | "unhealthy";
  let httpStatus: number;

  if (hasUnavailable) {
    overallStatus = "unhealthy";
    httpStatus = 503;
  } else if (hasDegraded) {
    overallStatus = "degraded";
    httpStatus = 200; // Still operational, just degraded
  } else {
    overallStatus = "healthy";
    httpStatus = 200;
  }

  logger.info("health.dependencies.check", {
    overallStatus,
    dependencies: dependencies.map((d) => ({ name: d.name, status: d.status })),
  });

  return {
    data: {
      status: overallStatus,
      timestamp,
      dependencies,
    },
    status: httpStatus,
    meta: {
      tags: ["health", "dependencies"],
    },
  };
});
