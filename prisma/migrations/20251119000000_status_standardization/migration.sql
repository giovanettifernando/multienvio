-- Migration: Padronização de Status de Shipments
-- Versão: 2.0
-- Data: 2025-11-19
--
-- Esta migração atualiza todos os status de shipments para o novo padrão unificado

-- =====================================================
-- PASSO 1: Backup dos status atuais (para auditoria)
-- =====================================================

-- Criar tabela temporária com snapshot dos status atuais
CREATE TEMP TABLE shipment_status_backup AS
SELECT
  id,
  status AS old_status,
  "pickupPointId",
  "createdAt"
FROM shipments;

-- =====================================================
-- PASSO 2: Migração de status (snake_case → UPPER_SNAKE_CASE)
-- =====================================================

-- Atualizar status obsoletos primeiro
UPDATE shipments
SET status = 'CANCELLED_BEFORE_HANDOFF'
WHERE status IN ('payment_failed', 'cancelled');

UPDATE shipments
SET status = 'PICKUP_REQUESTED'
WHERE status = 'pending_payment';

-- Migrar status de origem - Fluxo 1: Coleta
UPDATE shipments
SET status = 'PICKUP_REQUESTED'
WHERE status = 'awaiting_pickup';

-- Migrar status de origem - Fluxo 2: Ponto de coleta
UPDATE shipments
SET status = 'AWAITING_DROP_OFF_AT_POINT'
WHERE status = 'awaiting_posting';

-- Migrar status legacy (deprecated)
UPDATE shipments
SET status = 'RECEIVED_AT_ORIGIN_HUB'
WHERE status = 'ready_for_posting';

-- Migrar status de transporte
UPDATE shipments
SET status = 'RECEIVED_AT_ORIGIN_HUB'
WHERE status = 'posted';

UPDATE shipments
SET status = 'IN_TRANSIT_TO_DESTINATION'
WHERE status = 'in_transit';

UPDATE shipments
SET status = 'OUT_FOR_DELIVERY'
WHERE status = 'out_for_delivery';

-- Migrar status de entrega
UPDATE shipments
SET status = 'DELIVERED'
WHERE status = 'delivered';

-- Migrar status 'criado' com lógica de contexto
-- Se tem pickupPointId, está aguardando entrega no ponto
UPDATE shipments
SET status = 'AWAITING_DROP_OFF_AT_POINT'
WHERE status = 'criado' AND "pickupPointId" IS NOT NULL;

-- Se não tem pickupPointId, está aguardando coleta
UPDATE shipments
SET status = 'PICKUP_REQUESTED'
WHERE status = 'criado' AND "pickupPointId" IS NULL;

-- =====================================================
-- PASSO 3: Criar índices para os novos status
-- =====================================================

-- O índice já existe no schema: @@index([status])
-- Apenas garantir que está otimizado
REINDEX INDEX "shipments_status_idx";

-- =====================================================
-- PASSO 4: Relatório de migração
-- =====================================================

-- Gerar relatório com contagem de migrações
DO $$
DECLARE
  total_migrated INTEGER;
  status_distribution TEXT;
BEGIN
  SELECT COUNT(*) INTO total_migrated FROM shipments;

  RAISE NOTICE '==============================================';
  RAISE NOTICE 'MIGRAÇÃO DE STATUS CONCLUÍDA';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Total de shipments migrados: %', total_migrated;
  RAISE NOTICE '';
  RAISE NOTICE 'Distribuição de status após migração:';

  FOR status_distribution IN
    SELECT
      status || ': ' || COUNT(*) || ' registros'
    FROM shipments
    GROUP BY status
    ORDER BY COUNT(*) DESC
  LOOP
    RAISE NOTICE '  %', status_distribution;
  END LOOP;

  RAISE NOTICE '==============================================';
END $$;

-- =====================================================
-- PASSO 5: Comentários explicativos
-- =====================================================

COMMENT ON COLUMN shipments.status IS 'Status do envio - Padrão ShipmentStatus v2.0 (UPPER_SNAKE_CASE)';

-- Nota: A tabela temporária shipment_status_backup será descartada automaticamente
-- ao final da transação. Para manter histórico permanente, seria necessário
-- criar uma tabela de auditoria separada.
