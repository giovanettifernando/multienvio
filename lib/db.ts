import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
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
const isBuildPhase = process.env.NEXT_PHASE?.includes("build") ||
                     process.env.NEXT_PHASE?.includes("generate") ||
                     (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET);
const databaseConfig = resolveDatabaseConfig();

// ============================================================================
// DATABASE POOL CONFIGURATION
// ============================================================================

/**
 * Connection pool settings optimized for self-hosted environments
 * Adjust based on your server resources and expected load
 *
 * Environment variables:
 * - DB_POOL_MAX: Maximum connections (default: 20 prod, 10 dev)
 * - DB_POOL_MIN: Minimum idle connections (default: 2)
 * - DB_CONNECTION_TIMEOUT_MS: Wait time for connection (default: 10000)
 * - DB_IDLE_TIMEOUT_MS: Close idle connections after (default: 30000)
 * - DB_STATEMENT_TIMEOUT_MS: Max query time (default: 60000)
 * - DB_APPLICATION_NAME: App name in pg_stat_activity
 */
function getPoolConfig() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    connectionString: process.env.DATABASE_URL,

    // Pool size configuration
    // For self-hosted: (num_cores * 2) + spindles is a good baseline
    max: parseInt(process.env.DB_POOL_MAX || (isProduction ? "20" : "10"), 10),
    min: parseInt(process.env.DB_POOL_MIN || "2", 10),

    // Connection timeout: how long to wait for a connection from the pool (ms)
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || "10000", 10),

    // Idle timeout: close connections that have been idle for this long (ms)
    // Helps prevent "too many connections" errors
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || "30000", 10),

    // Allow exit when idle - important for serverless/containers
    allowExitOnIdle: process.env.DB_ALLOW_EXIT_ON_IDLE !== "false",

    // Statement timeout: maximum time for any query (ms)
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || "60000", 10),

    // Application name for monitoring in pg_stat_activity
    application_name: process.env.DB_APPLICATION_NAME || "enviolegal-app",
  };
}

function createPrismaClient() {
  // Prisma 7: usar adapter para conexão com PostgreSQL com pool otimizado
  const poolConfig = getPoolConfig();
  const pool = new Pool(poolConfig);

  // Log pool configuration in development
  if (process.env.NODE_ENV === "development") {
    console.log("[DB] Pool config:", {
      max: poolConfig.max,
      min: poolConfig.min,
      connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
      idleTimeoutMillis: poolConfig.idleTimeoutMillis,
    });
  }

  // Handle pool errors gracefully
  pool.on("error", (err) => {
    console.error("[DB] Unexpected pool error:", err.message);
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
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
      if (isBuildPhase) return;
      const trimmed = stdout.trim();
      if (!/Database schema is up to date/i.test(trimmed)) {
        console.warn("[DB] Prisma migrate status indicates pending changes. Run `npx prisma migrate deploy`.");
      }
    })
    .catch(() => {
      // Silently ignore migration check errors during build
    });

  return globalForPrisma.migrationCheck;
}

async function initializePrisma(client: PrismaClient) {
  if (typeof window !== "undefined" || isTestEnv) {
    return;
  }

  const attempts = Number(process.env.DB_CONNECT_RETRIES ?? 5);
  const backoffMs = Number(process.env.DB_CONNECT_BACKOFF_MS ?? 500);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
      if (!isBuildPhase) {
        await checkPendingMigrationsOnce();
      }
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      await sleep(backoffMs * attempt);
    }
  }
}

function registerShutdownHooks(client: PrismaClient) {
  if (typeof process === "undefined") return;
  if (globalForPrisma.disconnectRegistered) return;

  const disconnect = () => client.$disconnect().catch(() => {});

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
