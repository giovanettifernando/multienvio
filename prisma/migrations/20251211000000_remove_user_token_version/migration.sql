-- Migration: Remove tokenVersion from User table
-- Session tokenVersion is now managed in Redis only

-- Drop the column
ALTER TABLE "users" DROP COLUMN IF EXISTS "tokenVersion";
