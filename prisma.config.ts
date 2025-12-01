import path from 'node:path';
import { defineConfig } from 'prisma/config';

// prisma.config.ts - Configuração do Prisma 7 para CLI (migrations, db push, etc)
export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  // Datasource URL para comandos CLI (migrate, db push, etc)
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
