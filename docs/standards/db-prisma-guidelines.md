# DB/Prisma Guidelines - Envio Legal

## 1) Prisma schema conventions
- Model names em PascalCase e `@@map` para tabelas em snake_case. Evidencia: `prisma/schema.prisma`.
- Campos `createdAt`/`updatedAt` com defaults. Evidencia: `prisma/schema.prisma`.
- Indices explicitos por entidade. Evidencia: `prisma/schema.prisma`.
- Enums definidos no schema (`AdminPermission`, `WalletTxStatus`, `QuoteStatus`, etc). Evidencia: `prisma/schema.prisma`.

## 2) Migrations
- Migrations versionadas em `prisma/migrations`. Evidencia: `prisma/migrations/*`.
- CLI configurado via `prisma.config.ts`. Evidencia: `prisma.config.ts`.

## 3) Conexao e pool
- Pool do Postgres via `pg` + `PrismaPg` adapter. Evidencia: `platform/db/db.ts`.
- Pool configuravel por env (`DB_POOL_MAX`, `DB_POOL_MIN`, etc). Evidencia: `platform/db/db.ts`.

## 4) Validacao de ambiente
- `validateEnv()` garante variaveis criticas. Evidencia: `platform/db/env-validation.ts`.

## 5) Regras praticas para novos desenvolvimentos
- Sempre usar `prisma` exportado de `platform/db/db.ts`.
- Evitar acessar DB no client (lint impede). Evidencia: `eslint.config.mjs`.
- Preferir transacoes para atualizacoes financeiras/sensiveis. Evidencias: `app/api/admin/clients/[id]/wallet/adjust/route.ts`.

## 6) PostGIS
- `CepLocation` menciona cache de coordenadas e PostGIS (ainda modelado como lat/long). Evidencia: `prisma/schema.prisma`.
