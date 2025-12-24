-- Remove redundant index on wallets.userId
-- The userId column already has a UNIQUE constraint which creates an implicit index
-- This removes unnecessary storage overhead and write amplification

DROP INDEX IF EXISTS "wallets_userId_idx";
