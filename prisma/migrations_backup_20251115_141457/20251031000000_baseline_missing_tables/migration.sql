-- Baseline Migration: Create all tables that were missing from migration history
-- This migration was created retrospectively to match the actual database state
-- All these tables existed in the database but had no CREATE TABLE migrations

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');
CREATE TYPE "IntegrationEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
CREATE TYPE "AuthType" AS ENUM ('API_KEY', 'OAUTH2', 'BASIC', 'JWT', 'CUSTOM');
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN');
CREATE TYPE "collector_status" AS ENUM ('ACTIVE', 'BLOCKED', 'PENDING');
CREATE TYPE "commission_kind" AS ENUM ('FIXED', 'PERCENTAGE', 'PER_KM');
CREATE TYPE "bank_method_kind" AS ENUM ('PIX', 'BANK_TRANSFER');
CREATE TYPE "pix_key_type" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');
CREATE TYPE "account_type" AS ENUM ('CHECKING', 'SAVINGS');
CREATE TYPE "pickup_fee_type" AS ENUM ('FIXED', 'PER_KM');
CREATE TYPE "PickupPointStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'PENDING');
CREATE TYPE "ReceptionStatus" AS ENUM ('PENDING', 'RECEIVED', 'PROCESSED', 'ISSUE');
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'WALLET');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'PAID', 'REFUNDED', 'FAILED', 'CANCELLED');
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'QUOTED', 'SELECTED', 'CONFIRMED', 'EXPIRED');
CREATE TYPE "DocumentType" AS ENUM ('NFE', 'NFE_CHAVE', 'DECLARATION');
CREATE TYPE "WalletTxType" AS ENUM ('TOPUP', 'PAYMENT', 'REFUND', 'COMMISSION', 'PAYOUT');
CREATE TYPE "WalletTxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "LedgerEntryType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateTable: Carriers
CREATE TABLE "carriers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "environment" "IntegrationEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "baseUrl" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "logoUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CarrierService
CREATE TABLE "carrier_services" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minDays" INTEGER,
    "maxDays" INTEGER,
    "requiresInsurance" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CarrierEndpoint
CREATE TABLE "carrier_endpoints" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "timeout" INTEGER,
    "retryable" BOOLEAN NOT NULL DEFAULT true,
    "requestMapping" JSONB,
    "responseMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastTestedAt" TIMESTAMP(3),

    CONSTRAINT "carrier_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CarrierCredential
CREATE TABLE "carrier_credentials" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "environment" "IntegrationEnvironment" NOT NULL,
    "authType" "AuthType" NOT NULL,
    "apiKey" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "username" TEXT,
    "password" TEXT,
    "token" TEXT,
    "tokenUrl" TEXT,
    "scope" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "customHeaders" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRotatedAt" TIMESTAMP(3),

    CONSTRAINT "carrier_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CarrierWebhook
CREATE TABLE "carrier_webhooks" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "status" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CarrierHealthCheck
CREATE TABLE "carrier_health_checks" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL,
    "responseTime" INTEGER,
    "errorMessage" TEXT,
    "successRate" DECIMAL(5,2),
    "avgLatency" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrier_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CarrierApiCall
CREATE TABLE "carrier_api_calls" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "statusCode" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "carrier_api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CarrierPricingRule
CREATE TABLE "carrier_pricing_rules" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceId" TEXT,
    "originStates" TEXT,
    "destStates" TEXT,
    "minWeight" DECIMAL(6,2),
    "maxWeight" DECIMAL(6,2),
    "basePriceCents" INTEGER,
    "pricePerKg" DECIMAL(10,2),
    "insurancePercent" DECIMAL(5,2),
    "additionalFees" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Collector
CREATE TABLE "collectors" (
    "id" TEXT NOT NULL,
    "status" "collector_status" NOT NULL DEFAULT 'ACTIVE',
    "pfNome" TEXT NOT NULL,
    "pfCnhNumber" TEXT NOT NULL,
    "pfCnhCategory" TEXT NOT NULL,
    "pfCnhExpires" TIMESTAMP(3) NOT NULL,
    "pfCelular" TEXT NOT NULL,
    "pfWhatsapp" TEXT,
    "pfCep" TEXT,
    "pfLogradouro" TEXT,
    "pfNumero" TEXT,
    "pfComplemento" TEXT,
    "pfBairro" TEXT,
    "pfCidade" TEXT,
    "pfUf" VARCHAR(2),
    "pfGeo" JSONB,
    "pfCpf" TEXT,
    "pfEmail" TEXT,
    "pfEmailVerificationToken" TEXT,
    "pfEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "pfEmailVerifiedAt" TIMESTAMP(3),
    "pjRazaoSocial" TEXT NOT NULL,
    "pjCnpj" TEXT NOT NULL,
    "pjCep" TEXT,
    "pjLogradouro" TEXT,
    "pjNumero" TEXT,
    "pjComplemento" TEXT,
    "pjBairro" TEXT,
    "pjCidade" TEXT,
    "pjUf" VARCHAR(2),
    "pjGeo" JSONB,
    "vehiclePlate" TEXT NOT NULL,
    "vehicleBrand" TEXT NOT NULL,
    "vehicleModel" TEXT,
    "vehicleYear" TEXT,
    "commissionKind" "commission_kind" NOT NULL,
    "commissionAmount" DOUBLE PRECISION,
    "commissionAmountPerKm" DOUBLE PRECISION,
    "bankMethodKind" "bank_method_kind" NOT NULL,
    "bankPixType" "pix_key_type",
    "bankPixKey" TEXT,
    "bankCode" TEXT,
    "bankBranch" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" "account_type",
    "bankHolderName" TEXT,
    "bankHolderCnpj" TEXT,
    "pickupFeeType" "pickup_fee_type" NOT NULL DEFAULT 'FIXED',
    "pickupFixedFee" DOUBLE PRECISION,
    "pickupFeePerKm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CollectorDocument
CREATE TABLE "collector_documents" (
    "id" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "mimeType" TEXT,
    "size" INTEGER,
    "storageKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collector_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CollectorCredential
CREATE TABLE "collector_credentials" (
    "id" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collector_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PickupPoint
CREATE TABLE "pickup_points" (
    "id" TEXT NOT NULL,
    "status" "PickupPointStatus" NOT NULL DEFAULT 'ACTIVE',
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "ie" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" VARCHAR(2),
    "geo" JSONB,
    "paymentMethod" JSONB NOT NULL,
    "payoutDay" INTEGER,
    "minPayoutAmount" DECIMAL(10,2),
    "commissionPerItem" DECIMAL(10,2),
    "capacityPerDay" INTEGER,
    "monthlyReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordHash" TEXT,

    CONSTRAINT "pickup_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PickupRequest
CREATE TABLE "pickup_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "originCep" TEXT NOT NULL,
    "originAddress" TEXT,
    "originCity" TEXT,
    "originUf" VARCHAR(2),
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Reception
CREATE TABLE "receptions" (
    "id" TEXT NOT NULL,
    "pickupPointId" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "declaredValue" DOUBLE PRECISION,
    "status" "ReceptionStatus" NOT NULL DEFAULT 'PENDING',
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "issueType" TEXT,
    "issueDetails" TEXT,
    "issuePhotos" JSONB,
    "commissionCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Wallet
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableCents" INTEGER NOT NULL DEFAULT 0,
    "pendingCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WalletTransaction
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "status" "WalletTxStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "title" TEXT,
    "referenceId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LedgerEntry
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Label
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "trackingCode" TEXT,
    "fileUrl" TEXT,
    "fileBase64" TEXT,
    "contentType" TEXT DEFAULT 'application/pdf',
    "sizeBytes" INTEGER,
    "isPrinted" BOOLEAN NOT NULL DEFAULT false,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recipientName" TEXT,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Quote
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "originCep" VARCHAR(8) NOT NULL,
    "destCep" VARCHAR(8) NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "nfeNumber" TEXT,
    "nfeValue" DECIMAL(10,2),
    "isReverse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "selectedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QuoteVolume
CREATE TABLE "quote_volumes" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "height" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "length" INTEGER NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL,
    "cubicWeight" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "quote_volumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QuoteOption
CREATE TABLE "quote_options" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "carrierName" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "insuranceCents" INTEGER NOT NULL DEFAULT 0,
    "additionalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QuoteSelection
CREATE TABLE "quote_selections" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "carrierName" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Cart
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "totals" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CartItem
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "originAddress" JSONB NOT NULL,
    "destination" JSONB NOT NULL,
    "volumes" JSONB NOT NULL,
    "preferences" JSONB NOT NULL,
    "insuranceValue" DECIMAL(65,30),
    "pickupPoint" JSONB,
    "selectedQuote" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentGateway
CREATE TABLE "payment_gateways" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "environment" "IntegrationEnvironment" NOT NULL DEFAULT 'PRODUCTION',
    "baseUrl" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "enabledMethods" "PaymentMethod"[],
    "logoUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentEndpoint
CREATE TABLE "payment_endpoints" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "timeout" INTEGER,
    "retryable" BOOLEAN NOT NULL DEFAULT true,
    "requestMapping" JSONB,
    "responseMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastTestedAt" TIMESTAMP(3),

    CONSTRAINT "payment_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentCredential
CREATE TABLE "payment_credentials" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "environment" "IntegrationEnvironment" NOT NULL,
    "authType" "AuthType" NOT NULL,
    "merchantId" TEXT,
    "apiKey" TEXT,
    "publicKey" TEXT,
    "secretKey" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRotatedAt" TIMESTAMP(3),

    CONSTRAINT "payment_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentWebhook
CREATE TABLE "payment_webhooks" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "status" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentHealthCheck
CREATE TABLE "payment_health_checks" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL,
    "responseTime" INTEGER,
    "errorMessage" TEXT,
    "successRate" DECIMAL(5,2),
    "avgLatency" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentTransaction
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "externalId" TEXT,
    "referenceId" TEXT NOT NULL,
    "userId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "netCents" INTEGER NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "pixKey" TEXT,
    "pixQrCode" TEXT,
    "boletoUrl" TEXT,
    "boletoBarcode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentRefund
CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "externalId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentChargeback
CREATE TABLE "payment_chargebacks" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "externalId" TEXT,
    "reason" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "payment_chargebacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PackagingTemplate
CREATE TABLE "packaging_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lengthCm" DECIMAL(10,2) NOT NULL,
    "widthCm" DECIMAL(10,2) NOT NULL,
    "heightCm" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packaging_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PasswordResetToken
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carriers_slug_key" ON "carriers"("slug");
CREATE INDEX "carriers_slug_idx" ON "carriers"("slug");
CREATE INDEX "carriers_status_idx" ON "carriers"("status");

CREATE UNIQUE INDEX "carrier_services_carrierId_serviceId_key" ON "carrier_services"("carrierId", "serviceId");
CREATE INDEX "carrier_services_carrierId_isActive_idx" ON "carrier_services"("carrierId", "isActive");

CREATE UNIQUE INDEX "carrier_endpoints_carrierId_operation_key" ON "carrier_endpoints"("carrierId", "operation");
CREATE INDEX "carrier_endpoints_carrierId_idx" ON "carrier_endpoints"("carrierId");

CREATE INDEX "carrier_credentials_carrierId_environment_isActive_idx" ON "carrier_credentials"("carrierId", "environment", "isActive");

CREATE INDEX "carrier_webhooks_carrierId_status_nextRetryAt_idx" ON "carrier_webhooks"("carrierId", "status", "nextRetryAt");
CREATE INDEX "carrier_webhooks_externalId_idx" ON "carrier_webhooks"("externalId");
CREATE INDEX "carrier_webhooks_createdAt_idx" ON "carrier_webhooks"("createdAt");

CREATE INDEX "carrier_health_checks_carrierId_checkedAt_idx" ON "carrier_health_checks"("carrierId", "checkedAt");

CREATE INDEX "carrier_api_calls_carrierId_operation_startedAt_idx" ON "carrier_api_calls"("carrierId", "operation", "startedAt");
CREATE INDEX "carrier_api_calls_success_startedAt_idx" ON "carrier_api_calls"("success", "startedAt");

CREATE INDEX "carrier_pricing_rules_carrierId_isActive_priority_idx" ON "carrier_pricing_rules"("carrierId", "isActive", "priority");

CREATE UNIQUE INDEX "collectors_pfCpf_key" ON "collectors"("pfCpf");
CREATE UNIQUE INDEX "collectors_pfEmail_key" ON "collectors"("pfEmail");
CREATE UNIQUE INDEX "collectors_pjCnpj_key" ON "collectors"("pjCnpj");
CREATE UNIQUE INDEX "collectors_pfEmailVerificationToken_key" ON "collectors"("pfEmailVerificationToken");
CREATE INDEX "collectors_status_idx" ON "collectors"("status");
CREATE INDEX "collectors_pfCpf_idx" ON "collectors"("pfCpf");
CREATE INDEX "collectors_pfEmail_idx" ON "collectors"("pfEmail");
CREATE INDEX "collectors_pjCnpj_idx" ON "collectors"("pjCnpj");
CREATE INDEX "collectors_pfCidade_pfUf_idx" ON "collectors"("pfCidade", "pfUf");
CREATE INDEX "collectors_pjCidade_pjUf_idx" ON "collectors"("pjCidade", "pjUf");

CREATE UNIQUE INDEX "collector_documents_collectorId_type_key" ON "collector_documents"("collectorId", "type");
CREATE INDEX "collector_documents_collectorId_type_idx" ON "collector_documents"("collectorId", "type");

CREATE UNIQUE INDEX "collector_credentials_collectorId_key" ON "collector_credentials"("collectorId");

CREATE UNIQUE INDEX "pickup_points_cnpj_key" ON "pickup_points"("cnpj");
CREATE INDEX "pickup_points_cnpj_idx" ON "pickup_points"("cnpj");
CREATE INDEX "pickup_points_status_idx" ON "pickup_points"("status");
CREATE INDEX "pickup_points_uf_cidade_idx" ON "pickup_points"("uf", "cidade");

CREATE UNIQUE INDEX "pickup_requests_shipmentId_key" ON "pickup_requests"("shipmentId");
CREATE INDEX "pickup_requests_shipmentId_idx" ON "pickup_requests"("shipmentId");
CREATE INDEX "pickup_requests_userId_idx" ON "pickup_requests"("userId");
CREATE INDEX "pickup_requests_status_idx" ON "pickup_requests"("status");
CREATE INDEX "pickup_requests_originCep_idx" ON "pickup_requests"("originCep");
CREATE INDEX "pickup_requests_createdAt_idx" ON "pickup_requests"("createdAt");

CREATE INDEX "receptions_pickupPointId_idx" ON "receptions"("pickupPointId");
CREATE INDEX "receptions_status_idx" ON "receptions"("status");
CREATE INDEX "receptions_trackingCode_idx" ON "receptions"("trackingCode");

CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

CREATE INDEX "wallet_transactions_walletId_createdAt_idx" ON "wallet_transactions"("walletId", "createdAt");
CREATE INDEX "wallet_transactions_walletId_status_idx" ON "wallet_transactions"("walletId", "status");

CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");
CREATE INDEX "ledger_entries_type_createdAt_idx" ON "ledger_entries"("type", "createdAt");
CREATE INDEX "ledger_entries_accountType_accountId_createdAt_idx" ON "ledger_entries"("accountType", "accountId", "createdAt");

CREATE UNIQUE INDEX "labels_shipmentId_key" ON "labels"("shipmentId");
CREATE INDEX "labels_shipmentId_idx" ON "labels"("shipmentId");
CREATE INDEX "labels_status_idx" ON "labels"("status");
CREATE INDEX "labels_isPrinted_idx" ON "labels"("isPrinted");
CREATE INDEX "labels_createdAt_idx" ON "labels"("createdAt");

CREATE INDEX "quotes_userId_createdAt_idx" ON "quotes"("userId", "createdAt");
CREATE INDEX "quotes_userId_status_createdAt_idx" ON "quotes"("userId", "status", "createdAt");
CREATE INDEX "quotes_status_expiresAt_idx" ON "quotes"("status", "expiresAt");

CREATE INDEX "quote_volumes_quoteId_idx" ON "quote_volumes"("quoteId");

CREATE INDEX "quote_options_quoteId_idx" ON "quote_options"("quoteId");
CREATE INDEX "quote_options_quoteId_totalCents_idx" ON "quote_options"("quoteId", "totalCents");

CREATE UNIQUE INDEX "quote_selections_quoteId_key" ON "quote_selections"("quoteId");
CREATE INDEX "quote_selections_quoteId_idx" ON "quote_selections"("quoteId");

CREATE INDEX "carts_userId_status_idx" ON "carts"("userId", "status");

CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");

CREATE UNIQUE INDEX "payment_gateways_slug_key" ON "payment_gateways"("slug");
CREATE INDEX "payment_gateways_slug_idx" ON "payment_gateways"("slug");
CREATE INDEX "payment_gateways_status_idx" ON "payment_gateways"("status");

CREATE UNIQUE INDEX "payment_endpoints_gatewayId_operation_key" ON "payment_endpoints"("gatewayId", "operation");
CREATE INDEX "payment_endpoints_gatewayId_idx" ON "payment_endpoints"("gatewayId");

CREATE INDEX "payment_credentials_gatewayId_environment_isActive_idx" ON "payment_credentials"("gatewayId", "environment", "isActive");

CREATE INDEX "payment_webhooks_gatewayId_status_nextRetryAt_idx" ON "payment_webhooks"("gatewayId", "status", "nextRetryAt");
CREATE INDEX "payment_webhooks_externalId_idx" ON "payment_webhooks"("externalId");
CREATE INDEX "payment_webhooks_createdAt_idx" ON "payment_webhooks"("createdAt");

CREATE INDEX "payment_health_checks_gatewayId_checkedAt_idx" ON "payment_health_checks"("gatewayId", "checkedAt");

CREATE UNIQUE INDEX "payment_transactions_referenceId_key" ON "payment_transactions"("referenceId");
CREATE INDEX "payment_transactions_gatewayId_status_createdAt_idx" ON "payment_transactions"("gatewayId", "status", "createdAt");
CREATE INDEX "payment_transactions_userId_status_idx" ON "payment_transactions"("userId", "status");
CREATE INDEX "payment_transactions_referenceId_idx" ON "payment_transactions"("referenceId");
CREATE INDEX "payment_transactions_externalId_idx" ON "payment_transactions"("externalId");

CREATE INDEX "payment_refunds_transactionId_idx" ON "payment_refunds"("transactionId");

CREATE INDEX "payment_chargebacks_transactionId_idx" ON "payment_chargebacks"("transactionId");

CREATE INDEX "packaging_templates_userId_idx" ON "packaging_templates"("userId");

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
CREATE INDEX "password_reset_tokens_tokenHash_idx" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- AddForeignKey (referential integrity)
ALTER TABLE "carrier_services" ADD CONSTRAINT "carrier_services_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carrier_endpoints" ADD CONSTRAINT "carrier_endpoints_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carrier_credentials" ADD CONSTRAINT "carrier_credentials_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carrier_webhooks" ADD CONSTRAINT "carrier_webhooks_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carrier_health_checks" ADD CONSTRAINT "carrier_health_checks_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carrier_api_calls" ADD CONSTRAINT "carrier_api_calls_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carrier_pricing_rules" ADD CONSTRAINT "carrier_pricing_rules_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collector_documents" ADD CONSTRAINT "collector_documents_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "collectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collector_credentials" ADD CONSTRAINT "collector_credentials_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "collectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "pickup_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "labels" ADD CONSTRAINT "labels_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_volumes" ADD CONSTRAINT "quote_volumes_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_selections" ADD CONSTRAINT "quote_selections_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_selections" ADD CONSTRAINT "quote_selections_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "quote_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_endpoints" ADD CONSTRAINT "payment_endpoints_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_credentials" ADD CONSTRAINT "payment_credentials_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_webhooks" ADD CONSTRAINT "payment_webhooks_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_health_checks" ADD CONSTRAINT "payment_health_checks_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_chargebacks" ADD CONSTRAINT "payment_chargebacks_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "packaging_templates" ADD CONSTRAINT "packaging_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
