-- AlterTable: Add receivedAt and receivedBy fields to Shipment
ALTER TABLE "shipments" ADD COLUMN "receivedAt" TIMESTAMP(3),
                        ADD COLUMN "receivedBy" TEXT;

-- CreateTable: packages
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "packageNumber" INTEGER NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "hasDivergence" BOOLEAN NOT NULL DEFAULT false,
    "divergenceType" TEXT,
    "divergenceNotes" TEXT,
    "divergenceWidth" DOUBLE PRECISION,
    "divergenceHeight" DOUBLE PRECISION,
    "divergenceLength" DOUBLE PRECISION,
    "divergenceWeight" DOUBLE PRECISION,
    "divergenceRegisteredAt" TIMESTAMP(3),
    "divergenceRegisteredBy" TEXT,
    "checkedAt" TIMESTAMP(3),
    "checkedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packages_shipmentId_packageNumber_key" ON "packages"("shipmentId", "packageNumber");

-- CreateIndex
CREATE INDEX "packages_shipmentId_idx" ON "packages"("shipmentId");

-- CreateIndex
CREATE INDEX "packages_hasDivergence_idx" ON "packages"("hasDivergence");

-- CreateIndex
CREATE INDEX "packages_checkedAt_idx" ON "packages"("checkedAt");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
