-- Remove legacy companyId field from pickup_requests
-- Multi-tenant feature was never implemented - column is always null
-- No data loss expected as column contains no meaningful data

ALTER TABLE "pickup_requests" DROP COLUMN IF EXISTS "companyId";
