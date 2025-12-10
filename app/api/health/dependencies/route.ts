/**
 * Health check endpoint for all external dependencies
 * GET /api/health/dependencies - Checks database, external services, etc.
 */

import { withApiHandler } from "@/lib/api/handler";
import { pingDatabase, getPoolMetrics } from "@/lib/db";


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
 * Check Mercado Pago API connectivity (if configured)
 */
async function checkMercadoPago(): Promise<DependencyStatus> {
  const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return {
      name: "mercadopago",
      status: "degraded",
      message: "Access token not configured",
    };
  }

  const start = Date.now();
  try {
    // Simple API call to check connectivity - get payment methods
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://api.mercadopago.com/v1/payment_methods", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return {
        name: "mercadopago",
        status: "ok",
        latencyMs: Date.now() - start,
      };
    }

    return {
      name: "mercadopago",
      status: "degraded",
      latencyMs: Date.now() - start,
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: "mercadopago",
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
  const [database, mercadopago] = await Promise.all([
    checkDatabase(),
    checkMercadoPago(),
  ]);

  const environment = checkEnvironment();

  const dependencies: DependencyStatus[] = [
    database,
    mercadopago,
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
