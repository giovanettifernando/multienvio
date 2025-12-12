-- Remove tokenVersion columns from StaffUser, Collector, PickupPoint tables
-- These columns are now managed via Redis session cache
-- Migration: 20241211_remove_tokenversion_from_staff_collector_pickup

-- AlterTable: Remove tokenVersion from staff_users
ALTER TABLE "staff_users" DROP COLUMN IF EXISTS "tokenVersion";

-- AlterTable: Remove tokenVersion from collectors
ALTER TABLE "collectors" DROP COLUMN IF EXISTS "tokenVersion";

-- AlterTable: Remove tokenVersion from pickup_points
ALTER TABLE "pickup_points" DROP COLUMN IF EXISTS "tokenVersion";
