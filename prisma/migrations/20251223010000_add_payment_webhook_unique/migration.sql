-- SECURITY: Garantir idempotência de webhooks por gateway + externalId
-- Previne processamento duplicado de webhooks

-- Nota: externalId pode ser null, então usamos NULLS NOT DISTINCT para tratar nulls como iguais
-- Caso contrário, múltiplos webhooks com externalId=null do mesmo gateway seriam permitidos

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhooks_gatewayId_externalId_key"
ON "payment_webhooks" ("gatewayId", "externalId")
NULLS NOT DISTINCT;
