-- CreateTable
CREATE TABLE "recipients" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameSearch" TEXT NOT NULL,
    "email" VARCHAR(160),
    "document" VARCHAR(14),
    "phone" VARCHAR(20),
    "notes" VARCHAR(280),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "cep" VARCHAR(8) NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recipients_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "recipients_userId_idx" ON "recipients"("userId");
CREATE INDEX "recipients_userId_isDefault_idx" ON "recipients"("userId", "isDefault");
CREATE INDEX "recipients_userId_document_idx" ON "recipients"("userId", "document");
CREATE INDEX "recipients_userId_nameSearch_idx" ON "recipients"("userId", "nameSearch");
