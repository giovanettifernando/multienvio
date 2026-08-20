-- Documento do remetente congelado no envio, para a declaração de conteúdo.
ALTER TABLE "shipments" ADD COLUMN "senderDocument" TEXT;

-- Envios antigos: recuperável com certeza a partir do senderId, como o nome.
UPDATE "shipments" s
SET "senderDocument" = COALESCE(NULLIF(u."cnpj", ''), NULLIF(u."cpf", ''))
FROM "users" u
WHERE u."id" = s."senderId"
  AND s."senderDocument" IS NULL;
