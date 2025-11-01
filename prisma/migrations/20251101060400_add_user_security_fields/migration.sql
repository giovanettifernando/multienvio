-- Add security fields to users table
ALTER TABLE "users" ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "passwordHistory" JSONB;

-- Create user security events table
CREATE TABLE "user_security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_security_events_pkey" PRIMARY KEY ("id")
);

-- Create indexes for user_security_events
CREATE INDEX "user_security_events_userId_idx" ON "user_security_events"("userId");
CREATE INDEX "user_security_events_userId_type_idx" ON "user_security_events"("userId", "type");
CREATE INDEX "user_security_events_createdAt_idx" ON "user_security_events"("createdAt");

-- Add foreign key constraint
ALTER TABLE "user_security_events" ADD CONSTRAINT "user_security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
