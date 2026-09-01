-- Chave de acesso da DC-e, informada pelo remetente após emitir no app da SEFAZ.
ALTER TABLE "shipments" ADD COLUMN "dceKey" TEXT;
CREATE UNIQUE INDEX "shipments_dceKey_key" ON "shipments"("dceKey");
