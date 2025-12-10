import { withApiHandler } from "@/lib/api/handler";
import { pingDatabase, schedulePrismaReconnect, getPoolMetrics, type PoolMetrics } from "@/lib/db";

type HealthDbResponse =
  | { status: "ok"; pool: PoolMetrics; latencyMs: number }
  | { status: "unavailable"; pool: PoolMetrics };

export const GET = withApiHandler<HealthDbResponse>(async ({ logger }) => {
  const pool = getPoolMetrics();
  const start = Date.now();

  try {
    await pingDatabase();
    const latencyMs = Date.now() - start;

    return {
      data: { status: "ok", pool, latencyMs },
      meta: { tags: ["health", "db"] },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("health.db.unavailable", { message, pool });
    void schedulePrismaReconnect();
    return {
      data: { status: "unavailable", pool },
      status: 503,
      meta: { tags: ["health", "db"] },
    };
  }
});
