-- Comissão de seguro por transportadora: pontos percentuais somados sobre o
-- valor declarado pelo cliente. Começa em 1% para todas, conforme definido.
ALTER TABLE "carriers" ADD COLUMN "insurance_commission_percent" DECIMAL(5,2);

UPDATE "carriers" SET "insurance_commission_percent" = 1.00;
