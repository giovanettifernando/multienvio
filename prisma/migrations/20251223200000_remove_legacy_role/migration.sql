-- Remove legacy Role system
-- Role table and User.roleId are not used in runtime
-- Permissions system migrated to StaffUser.permissions

-- Step 1: Remove the foreign key constraint and column from users
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_roleId_fkey";
ALTER TABLE "users" DROP COLUMN IF EXISTS "roleId";

-- Step 2: Drop the roles table
DROP TABLE IF EXISTS "roles";
