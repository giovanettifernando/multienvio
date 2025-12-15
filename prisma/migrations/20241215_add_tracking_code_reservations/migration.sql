-- CreateTable: tracking_code_reservations
-- Reserva de códigos de rastreamento para garantir unicidade
-- Códigos são reservados antes do pagamento e usados após confirmação

CREATE TABLE "tracking_code_reservations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shipment_id" TEXT,
    "used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_code_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_code_reservations_code_key" ON "tracking_code_reservations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_code_reservations_shipment_id_key" ON "tracking_code_reservations"("shipment_id");

-- CreateIndex
CREATE INDEX "tracking_code_reservations_user_id_idx" ON "tracking_code_reservations"("user_id");

-- CreateIndex
CREATE INDEX "tracking_code_reservations_expires_at_idx" ON "tracking_code_reservations"("expires_at");

-- CreateIndex
CREATE INDEX "tracking_code_reservations_used_at_idx" ON "tracking_code_reservations"("used_at");

-- AddForeignKey
ALTER TABLE "tracking_code_reservations" ADD CONSTRAINT "tracking_code_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
