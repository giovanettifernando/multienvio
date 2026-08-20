-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "originAddress" TEXT,
ADD COLUMN     "originCity" TEXT,
ADD COLUMN     "originNeighborhood" TEXT,
ADD COLUMN     "originState" TEXT,
ADD COLUMN     "senderName" TEXT;
