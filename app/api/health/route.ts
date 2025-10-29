import packageJson from "@/package.json";
import { withApiHandler } from "@/lib/api/handler";
import { getAppStartedAtIso } from "@/lib/api/runtime";

const VERSION = packageJson.version ?? "0.0.0";

export const GET = withApiHandler(async ({ logger }) => {
  const uptimeSeconds = Number(process.uptime().toFixed(3));
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT ??
    "local";
  const startedAt = getAppStartedAtIso();
  const timestamp = new Date().toISOString();

  logger.debug("health.probe", {
    uptimeSeconds,
    commit,
  });

  return {
    data: {
      status: "ok",
      timestamp,
      uptimeSeconds,
      startedAt,
      version: VERSION,
      commit,
      environment: process.env.NODE_ENV ?? "development",
    },
    meta: {
      tags: ["health"],
    },
  };
});
