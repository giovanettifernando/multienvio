-- CreateIndex: Ensure only one OPEN cart per user
-- This partial unique index enforces the business rule that each user can have only one active cart

CREATE UNIQUE INDEX IF NOT EXISTS "carts_user_open_unique" ON "carts" ("userId") WHERE "status" = 'OPEN';

-- Also add unique index for LOCKED status to prevent race conditions during checkout
CREATE UNIQUE INDEX IF NOT EXISTS "carts_user_locked_unique" ON "carts" ("userId") WHERE "status" = 'LOCKED';
