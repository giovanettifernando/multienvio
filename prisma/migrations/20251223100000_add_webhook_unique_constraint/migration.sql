-- SECURITY: Adiciona constraint unique parcial para evitar processamento duplicado de webhooks
-- A constraint é parcial porque externalId pode ser null para alguns eventos

-- Primeiro, remover duplicatas mantendo apenas o registro mais recente
-- PaymentWebhook: deletar duplicatas
DELETE FROM "payment_webhooks" pw1
WHERE pw1."externalId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "payment_webhooks" pw2
    WHERE pw2."gatewayId" = pw1."gatewayId"
      AND pw2."externalId" = pw1."externalId"
      AND pw2."createdAt" > pw1."createdAt"
  );

-- PaymentTransaction: deletar duplicatas
DELETE FROM "payment_transactions" pt1
WHERE pt1."externalId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "payment_transactions" pt2
    WHERE pt2."gatewayId" = pt1."gatewayId"
      AND pt2."externalId" = pt1."externalId"
      AND pt2."createdAt" > pt1."createdAt"
  );

-- PaymentWebhook: unique por gateway + externalId (quando externalId não é null)
CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhooks_gateway_external_unique"
ON "payment_webhooks" ("gatewayId", "externalId")
WHERE "externalId" IS NOT NULL;

-- PaymentTransaction: unique por gateway + externalId (quando externalId não é null)
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_gateway_external_unique"
ON "payment_transactions" ("gatewayId", "externalId")
WHERE "externalId" IS NOT NULL;
