-- SECURITY: Adiciona CHECK constraint para garantir que saldo nunca fique negativo
-- Isso previne race conditions e bugs que poderiam gerar saldo negativo

-- Primeiro verifica se não existe saldo negativo (a migration vai falhar se houver)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM wallets WHERE "availableCents" < 0 OR "pendingCents" < 0) THEN
    RAISE EXCEPTION 'Existem wallets com saldo negativo. Corrija antes de aplicar esta migration.';
  END IF;
END $$;

-- Adicionar constraint de saldo não-negativo
ALTER TABLE wallets ADD CONSTRAINT chk_wallet_available_cents_non_negative
  CHECK ("availableCents" >= 0);

ALTER TABLE wallets ADD CONSTRAINT chk_wallet_pending_cents_non_negative
  CHECK ("pendingCents" >= 0);
