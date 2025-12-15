-- Adicionar campo de comissao sobre frete na tabela carriers
ALTER TABLE "carriers" ADD COLUMN "shipping_commission_percent" DECIMAL(5, 2);

-- Migrar valor atual de platform_commissions.shipping_commission_percent para o carrier correios
UPDATE "carriers"
SET "shipping_commission_percent" = (
    SELECT "shipping_commission_percent"
    FROM "platform_commissions"
    WHERE "is_active" = true
    ORDER BY "updated_at" DESC
    LIMIT 1
)
WHERE "slug" = 'correios';
