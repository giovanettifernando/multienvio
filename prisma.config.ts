import path from 'node:path';
// O Prisma 7 não lê o .env sozinho. Sem isto, qualquer comando de CLI
// (migrate, db push, seed) morre com "datasource.url property is required".
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// prisma.config.ts - Configuração do Prisma 7 para CLI (migrations, db push, etc)
export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  // Datasource URL para comandos CLI (migrate, db push, etc)
  datasource: {
    url: process.env.DATABASE_URL!,
  },

  // Seed: um comando só — o Prisma não executa via shell, então "&&" não
  // funciona aqui. O seed principal chama o do FAQ.
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
