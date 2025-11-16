-- AlterTable: Rename trackingCode to platformTrackingCode and add carrierTrackingCode
-- This migration preserves existing data by copying trackingCode to platformTrackingCode

-- Step 1: Add new platformTrackingCode column (nullable temporarily)
ALTER TABLE "shipments" ADD COLUMN "platformTrackingCode" TEXT;

-- Step 2: Add carrierTrackingCode column (nullable, will remain nullable)
ALTER TABLE "shipments" ADD COLUMN "carrierTrackingCode" TEXT;

-- Step 3: Copy existing trackingCode values to platformTrackingCode
UPDATE "shipments" SET "platformTrackingCode" = "trackingCode";

-- Step 4: Make platformTrackingCode required and unique
ALTER TABLE "shipments" ALTER COLUMN "platformTrackingCode" SET NOT NULL;
CREATE UNIQUE INDEX "shipments_platformTrackingCode_key" ON "shipments"("platformTrackingCode");

-- Step 5: Drop the old trackingCode column and its index
DROP INDEX IF EXISTS "shipments_trackingCode_idx";
DROP INDEX IF EXISTS "shipments_trackingCode_key";
ALTER TABLE "shipments" DROP COLUMN "trackingCode";

-- Step 6: Create indexes for the new columns
CREATE INDEX "shipments_platformTrackingCode_idx" ON "shipments"("platformTrackingCode");
CREATE INDEX "shipments_carrierTrackingCode_idx" ON "shipments"("carrierTrackingCode");
