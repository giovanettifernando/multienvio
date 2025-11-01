import fs from "node:fs";
import path from "node:path";

type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  schema: string;
  url: string;
  envFiles: string[];
};

const DEFAULTS = {
  host: "localhost",
  port: 5432,
  user: "envio",
  password: "envio",
  name: "enviolegal",
  schema: "public",
};

const ENV_FILES_TO_CHECK = [".env.local", ".env"];

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function buildDatabaseUrl(config: Omit<DatabaseConfig, "url" | "envFiles">) {
  const auth =
    config.password !== undefined && config.password !== ""
      ? `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}`
      : encodeURIComponent(config.user);

  return `postgresql://${auth}@${config.host}:${config.port}/${config.name}?schema=${config.schema}`;
}

export function resolveDatabaseConfig(): DatabaseConfig {
  const host = process.env.DB_HOST ?? DEFAULTS.host;
  const port = readNumber(process.env.DB_PORT, DEFAULTS.port);
  const user = process.env.DB_USER ?? DEFAULTS.user;
  const password = process.env.DB_PASSWORD ?? DEFAULTS.password;
  const name = process.env.DB_NAME ?? DEFAULTS.name;
  const schema = process.env.DB_SCHEMA ?? DEFAULTS.schema;

  const baseConfig = { host, port, user, password, name, schema };

  const url =
    process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0
      ? process.env.DATABASE_URL
      : buildDatabaseUrl(baseConfig);

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = url;
  }

  const envFiles = ENV_FILES_TO_CHECK.filter((file) =>
    fs.existsSync(path.join(process.cwd(), file)),
  );

  return {
    ...baseConfig,
    url,
    envFiles,
  };
}
