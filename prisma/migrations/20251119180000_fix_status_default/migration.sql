-- Migration: Fix status column DEFAULT value
-- Data: 2025-11-19 18:00:00
--
-- Esta migração corrige o valor DEFAULT da coluna status
-- para alinhar com o Prisma schema e o novo padrão de status

-- Atualizar o DEFAULT VALUE da coluna status
ALTER TABLE "shipments"
ALTER COLUMN "status" SET DEFAULT 'PICKUP_REQUESTED';

-- Comentário explicativo
COMMENT ON COLUMN "shipments"."status" IS 'Status do envio - Padrão ShipmentStatus v2.0 (UPPER_SNAKE_CASE). Default: PICKUP_REQUESTED';
