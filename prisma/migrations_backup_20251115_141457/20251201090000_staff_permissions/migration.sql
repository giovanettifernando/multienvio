-- Create enum type for admin permissions
CREATE TYPE "AdminPermission" AS ENUM (
  'CONTAS',
  'FINANCEIRO',
  'OPERACOES',
  'INTEGRACOES',
  'SUPORTE',
  'COLETORES',
  'PONTOS_COLETA',
  'USUARIOS',
  'CONFIGURACOES'
);

ALTER TABLE "staff_users"
  ADD COLUMN "lastAccessAt" TIMESTAMP(3),
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "permissions" "AdminPermission"[] NOT NULL DEFAULT ARRAY[]::"AdminPermission"[];
