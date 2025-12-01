import { withApiHandler } from "@/lib/api/handler";
import { pingDatabase, schedulePrismaReconnect } from "@/lib/db";


export const GET = withApiHandler(async ({ logger }) => {
  try {
    await pingDatabase();
    return {
      data: { status: "ok" },
      meta: { tags: ["health", "db"] },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("health.db.unavailable", { message });
    void schedulePrismaReconnect();
    return {
      data: { status: "unavailable" },
      status: 503,
      meta: { tags: ["health", "db"] },
    };
  }
});
