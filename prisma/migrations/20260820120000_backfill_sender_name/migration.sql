-- Envios criados antes de `senderName` existir ficaram sem o nome do remetente.
-- O remetente é sempre o dono da conta, então o valor é recuperável com
-- certeza a partir de senderId. O endereço de origem completo NÃO é
-- recuperável (o usuário pode ter trocado de endereço desde então), por isso
-- só o nome é preenchido aqui — a tela cai para o CEP nos envios antigos.
UPDATE "shipments" s
SET "senderName" = COALESCE(NULLIF(u."razaoSocial", ''), u."name")
FROM "users" u
WHERE u."id" = s."senderId"
  AND s."senderName" IS NULL;
