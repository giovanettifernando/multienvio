import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import { Prisma, PrismaClient } from "@prisma/client";
import { resolveDatabaseConfig } from "./config/database";
import { validateEnv } from "./env-validation";

// Validate environment variables (warns during build, throws at runtime in production)
validateEnv();

type GlobalPrismaStore = {
  prisma?: PrismaClient;
  prismaReady?: Promise<void>;
  migrationCheck?: Promise<void>;
  disconnectRegistered?: boolean;
};

const execFileAsync = promisify(execFile);
const globalForPrisma = globalThis as unknown as GlobalPrismaStore;
const isTestEnv = process.env.NODE_ENV === "test";
const databaseConfig = resolveDatabaseConfig();

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkPendingMigrationsOnce(): Promise<void> {
  if (isTestEnv) return;
  if (globalForPrisma.migrationCheck) return globalForPrisma.migrationCheck;

  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const args = ["prisma", "migrate", "status", "--schema", path.join(process.cwd(), "prisma", "schema.prisma")];

  globalForPrisma.migrationCheck = execFileAsync(command, args, {
    env: process.env,
    cwd: process.cwd(),
    timeout: 30_000,
  })
    .then(({ stdout }) => {
      const trimmed = stdout.trim();
      if (/Database schema is up to date/i.test(trimmed)) {
        console.info("[DB] Prisma migrations are up to date.");
      } else {
        console.warn("[DB] Prisma migrate status indicates pending changes. Run `npx prisma migrate deploy`.");
        console.warn(trimmed);
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[DB] Unable to run `prisma migrate status` automatically.", message);
    });

  return globalForPrisma.migrationCheck;
}

async function initializePrisma(client: PrismaClient) {
  if (typeof window !== "undefined" || isTestEnv) {
    return;
  }

  const attempts = Number(process.env.DB_CONNECT_RETRIES ?? 5);
  const backoffMs = Number(process.env.DB_CONNECT_BACKOFF_MS ?? 500);

  console.info(
    `[DB] Connecting to PostgreSQL at ${databaseConfig.host}:${databaseConfig.port} (db: ${databaseConfig.name}, schema: ${databaseConfig.schema}). Env files: ${
      databaseConfig.envFiles.length ? databaseConfig.envFiles.join(", ") : "none detected"
    }.`,
  );

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
      console.info(`[DB] Connection established (${databaseConfig.host}:${databaseConfig.port}).`);
      await checkPendingMigrationsOnce();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[DB] Connection attempt ${attempt}/${attempts} failed: ${message}`);
      if (attempt === attempts) {
        console.error("[DB] Exhausted connection attempts. Database remains unavailable.");
        throw error;
      }
      await sleep(backoffMs * attempt);
    }
  }
}

function registerShutdownHooks(client: PrismaClient) {
  if (typeof process === "undefined") return;
  if (globalForPrisma.disconnectRegistered) return;

  const disconnect = () =>
    client
      .$disconnect()
      .then(() => {
        console.info("[DB] Prisma client disconnected.");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[DB] Error disconnecting Prisma client.", message);
      });

  process.once("beforeExit", () => void disconnect());
  process.once("SIGINT", () => {
    void disconnect().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void disconnect().finally(() => process.exit(0));
  });

  globalForPrisma.disconnectRegistered = true;
}

const prismaClient = globalForPrisma.prisma ?? createPrismaClient();
registerShutdownHooks(prismaClient);

const readyPromise =
  globalForPrisma.prismaReady ??
  initializePrisma(prismaClient).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[DB] Prisma failed to initialize.", message);
    throw error;
  });

globalForPrisma.prisma = prismaClient;
globalForPrisma.prismaReady = readyPromise;

export const prisma = prismaClient;
export const prismaReady = readyPromise;

export async function pingDatabase() {
  await prismaReady;
  await prisma.$queryRaw`SELECT 1`;
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001";
  }
  if (error instanceof Error) {
    return /Can't reach database server/i.test(error.message);
  }
  return false;
}

export async function schedulePrismaReconnect() {
  if (typeof window !== "undefined") return;
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  globalForPrisma.prismaReady = initializePrisma(prisma);
  return globalForPrisma.prismaReady;
}

export default prisma;
