-- Add tokenVersion field to users table for session invalidation
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
