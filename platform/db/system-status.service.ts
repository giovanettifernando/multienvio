import type { RequestLogger } from "@/platform/api/types";
import {
  getSystemStatus as repoGetSystemStatus,
  updateSystemStatus as repoUpdateSystemStatus,
  type SystemStatusRecord,
} from "@/platform/db/system-status.repository";

export type SystemStatusView = SystemStatusRecord;

type UpdateInput = Partial<Pick<SystemStatusRecord, "maintenance" | "message">>;

export async function getSystemStatus(logger?: RequestLogger): Promise<SystemStatusView> {
  const status = await repoGetSystemStatus();
  logger?.debug("system.status.fetched", {
    maintenance: status.maintenance,
    updatedAt: status.updatedAt,
  });
  return status;
}

export async function updateSystemStatus(
  input: UpdateInput,
  logger?: RequestLogger,
): Promise<SystemStatusView> {
  const updated = await repoUpdateSystemStatus(input);
  logger?.audit("system.status.updated", {
    maintenance: updated.maintenance,
    updatedAt: updated.updatedAt,
  });
  return updated;
}
