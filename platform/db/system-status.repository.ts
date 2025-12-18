import fs from "fs/promises";
import path from "path";

export type SystemStatusRecord = {
  maintenance: boolean;
  message: string;
  updatedAt: string;
};

type SystemStatusUpdate = Partial<Omit<SystemStatusRecord, "updatedAt">>;

const DEFAULT_STATUS: SystemStatusRecord = {
  maintenance: false,
  message: "Serviços operacionais.",
  updatedAt: new Date(0).toISOString(),
};

const dataPath = path.join(process.cwd(), "data/system-status.json");

let cache: SystemStatusRecord | null = null;
let syncing: Promise<void> | null = null;

async function ensureDataDir() {
  const dir = path.dirname(dataPath);
  await fs.mkdir(dir, { recursive: true });
}

async function readFromDisk(): Promise<SystemStatusRecord> {
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATUS,
      ...parsed,
      updatedAt: parsed?.updatedAt ?? DEFAULT_STATUS.updatedAt,
    };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      await writeToDisk(DEFAULT_STATUS);
      return DEFAULT_STATUS;
    }
    throw error;
  }
}

async function writeToDisk(data: SystemStatusRecord) {
  await ensureDataDir();
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(dataPath, `${json}\n`, "utf8");
}

function clone(status: SystemStatusRecord): SystemStatusRecord {
  return JSON.parse(JSON.stringify(status));
}

export async function getSystemStatus(): Promise<SystemStatusRecord> {
  if (cache) {
    return clone(cache);
  }

  cache = await readFromDisk();
  return clone(cache);
}

export async function updateSystemStatus(
  input: SystemStatusUpdate,
): Promise<SystemStatusRecord> {
  const current = await getSystemStatus();
  const next: SystemStatusRecord = {
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  cache = next;

  const sync = writeToDisk(next).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "system-status.write.failed",
        message: (error as Error).message,
      }),
    );
  });

  syncing = sync;
  await sync;
  syncing = null;

  return clone(next);
}

export async function waitForSync() {
  if (syncing) {
    await syncing;
  }
}
