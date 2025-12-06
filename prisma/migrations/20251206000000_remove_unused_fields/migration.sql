-- Remover campos não utilizados da tabela Address
ALTER TABLE "addresses" DROP COLUMN IF EXISTS "name";
ALTER TABLE "addresses" DROP COLUMN IF EXISTS "cpfCnpj";
ALTER TABLE "addresses" DROP COLUMN IF EXISTS "referencia";
ALTER TABLE "addresses" DROP COLUMN IF EXISTS "role";

-- Remover índice antigo e criar novo
DROP INDEX IF EXISTS "addresses_userId_role_idx";
CREATE INDEX IF NOT EXISTS "addresses_userId_idx" ON "addresses"("userId");

-- Remover campo não utilizado da tabela CarrierApiCall
ALTER TABLE "carrier_api_calls" DROP COLUMN IF EXISTS "requestBody";

-- Remover tabelas PaymentRefund e PaymentChargeback
DROP TABLE IF EXISTS "payment_refunds";
DROP TABLE IF EXISTS "payment_chargebacks";

-- Remover campo e índice não utilizados da tabela LedgerEntry
DROP INDEX IF EXISTS "ledger_entries_transactionId_idx";
ALTER TABLE "ledger_entries" DROP COLUMN IF EXISTS "transactionId";
