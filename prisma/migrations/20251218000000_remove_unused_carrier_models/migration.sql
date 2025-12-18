-- Migration: remove_unused_carrier_models
-- Description: Remove 5 Carrier* models that were never used in the codebase
-- Tables affected: carrier_services, carrier_endpoints, carrier_pricing_rules, carrier_webhooks, carrier_api_calls

-- Drop foreign key constraints
ALTER TABLE "carrier_services" DROP CONSTRAINT IF EXISTS "carrier_services_carrierId_fkey";
ALTER TABLE "carrier_endpoints" DROP CONSTRAINT IF EXISTS "carrier_endpoints_carrierId_fkey";
ALTER TABLE "carrier_pricing_rules" DROP CONSTRAINT IF EXISTS "carrier_pricing_rules_carrierId_fkey";
ALTER TABLE "carrier_webhooks" DROP CONSTRAINT IF EXISTS "carrier_webhooks_carrierId_fkey";
ALTER TABLE "carrier_api_calls" DROP CONSTRAINT IF EXISTS "carrier_api_calls_carrierId_fkey";

-- Drop indexes
DROP INDEX IF EXISTS "carrier_services_carrierId_isActive_idx";
DROP INDEX IF EXISTS "carrier_services_carrierId_serviceId_key";
DROP INDEX IF EXISTS "carrier_endpoints_carrierId_idx";
DROP INDEX IF EXISTS "carrier_endpoints_carrierId_operation_key";
DROP INDEX IF EXISTS "carrier_pricing_rules_carrierId_isActive_priority_idx";
DROP INDEX IF EXISTS "carrier_webhooks_carrierId_status_nextRetryAt_idx";
DROP INDEX IF EXISTS "carrier_webhooks_externalId_idx";
DROP INDEX IF EXISTS "carrier_webhooks_createdAt_idx";
DROP INDEX IF EXISTS "carrier_api_calls_carrierId_operation_startedAt_idx";
DROP INDEX IF EXISTS "carrier_api_calls_success_startedAt_idx";

-- Drop tables
DROP TABLE IF EXISTS "carrier_services";
DROP TABLE IF EXISTS "carrier_endpoints";
DROP TABLE IF EXISTS "carrier_pricing_rules";
DROP TABLE IF EXISTS "carrier_webhooks";
DROP TABLE IF EXISTS "carrier_api_calls";
