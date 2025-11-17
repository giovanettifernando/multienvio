-- CreateTable
CREATE TABLE "recurring_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_unitario" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_items_user_id_idx" ON "recurring_items"("user_id");

-- AddForeignKey
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
