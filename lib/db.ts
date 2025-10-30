import { PrismaClient } from '@prisma/client';

// PrismaClient é anexado ao objeto `global` em desenvolvimento para evitar
// instanciar vários clientes durante hot-reloading no Next.js
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
