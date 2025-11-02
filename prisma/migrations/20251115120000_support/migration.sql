-- Create support enums
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "SupportAuthorRole" AS ENUM ('USER', 'AGENT');

-- Create support_tickets table
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" JSONB,
    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- Create support_messages table
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" "SupportAuthorRole" NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- Create support_attachments table
CREATE TABLE "support_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_messages"
    ADD CONSTRAINT "support_messages_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_attachments"
    ADD CONSTRAINT "support_attachments_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "support_messages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "support_tickets_status_priority_createdAt_idx"
    ON "support_tickets"("status", "priority", "createdAt");

CREATE INDEX "support_tickets_userId_createdAt_idx"
    ON "support_tickets"("userId", "createdAt");

CREATE INDEX "support_tickets_assignedTo_idx"
    ON "support_tickets"("assignedTo");

CREATE INDEX "support_messages_ticketId_createdAt_idx"
    ON "support_messages"("ticketId", "createdAt");

CREATE INDEX "support_attachments_messageId_idx"
    ON "support_attachments"("messageId");
