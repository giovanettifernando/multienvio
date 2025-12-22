/**
 * Database client for scripts (without server-only restriction)
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Load environment variables from .env.local or .env
config({ path: '.env.local' });
config({ path: '.env' });

let prismaInstance: PrismaClient | null = null;

export function getScriptPrisma(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
  });

  const adapter = new PrismaPg(pool);

  prismaInstance = new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  });

  return prismaInstance;
}

export const prisma = getScriptPrisma();
