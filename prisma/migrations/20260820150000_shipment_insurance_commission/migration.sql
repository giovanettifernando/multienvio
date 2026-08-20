-- Comissão de seguro registrada por envio, separada da de frete.
ALTER TABLE "shipments" ADD COLUMN "platform_insurance_commission_cents" INTEGER;
