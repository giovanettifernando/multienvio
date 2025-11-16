-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AdminPermission" AS ENUM ('CONTAS', 'FINANCEIRO', 'OPERACOES', 'INTEGRACOES', 'SUPORTE', 'COLETORES', 'PONTOS_COLETA', 'USUARIOS', 'CONFIGURACOES');

-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('TOPUP', 'PURCHASE', 'REFUND', 'WITHDRAW', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletTxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportAuthorRole" AS ENUM ('USER', 'AGENT');

-- CreateEnum
CREATE TYPE "PickupPointStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "ReceptionStatus" AS ENUM ('PENDING', 'RECEIVED', 'ISSUE_REPORTED', 'PROCESSED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SELECTED', 'CONFIRMED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NFE', 'DECLARATION');

-- CreateEnum
CREATE TYPE "IntegrationEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'TESTING');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('API_KEY', 'OAUTH2', 'BASIC', 'BEARER', 'SIGNED_HEADER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'WALLET');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'PAID', 'REFUNDED', 'CHARGEBACK', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('CHARGE', 'REFUND', 'CHARGEBACK', 'FEE', 'PAYOUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "collector_status" AS ENUM ('ACTIVE', 'BLOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "pix_key_type" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('CORRENTE', 'POUPANCA');

-- CreateEnum
CREATE TYPE "commission_kind" AS ENUM ('FIXA', 'POR_KM');

-- CreateEnum
CREATE TYPE "bank_method_kind" AS ENUM ('PIX', 'TRANSFER');

-- CreateEnum
CREATE TYPE "pickup_fee_type" AS ENUM ('FIXED', 'PER_KM');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "roleId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerificationToken" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "resetPasswordExpiry" TIMESTAMP(3),
    "resetPasswordToken" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "cpf" TEXT,
    "cnpj" TEXT,
    "hasCompany" BOOLEAN NOT NULL DEFAULT false,
    "razaoSocial" TEXT,
    "passwordUpdatedAt" TIMESTAMP(3),
    "passwordHistory" JSONB,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "cep" VARCHAR(8) NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "cpfCnpj" TEXT,
    "name" TEXT,
    "referencia" TEXT,
    "role" TEXT DEFAULT 'recipient',

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brand" "CardBrand" NOT NULL,
    "holderName" TEXT NOT NULL,
    "last4" VARCHAR(4) NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "billingAddressId" TEXT,
    "vaultToken" TEXT NOT NULL,
    "panCipher" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipients" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameSearch" TEXT NOT NULL,
    "email" VARCHAR(160),
    "document" VARCHAR(14),
    "phone" VARCHAR(20),
    "notes" VARCHAR(280),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "cep" VARCHAR(8) NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "platformTrackingCode" TEXT NOT NULL,
    "carrierTrackingCode" TEXT,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "recipientDocument" TEXT,
    "destinationAddress" TEXT,
    "destinationNeighborhood" TEXT,
    "destinationCity" TEXT NOT NULL,
    "destinationState" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "declaredValue" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'criado',
    "carrier" TEXT,
    "service" TEXT,
    "originCep" TEXT NOT NULL,
    "destinationCep" TEXT NOT NULL,
    "estimatedDays" INTEGER,
    "freightCost" DOUBLE PRECISION,
    "pickupPointId" TEXT,
    "document" JSONB,
    "paymentMethod" TEXT,
    "publicTrackingId" TEXT,
    "publicTrackingAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "trackingCode" TEXT,
    "recipientName" TEXT,
    "fileUrl" TEXT,
    "fileBase64" TEXT,
    "contentType" TEXT DEFAULT 'application/pdf',
    "sizeBytes" INTEGER,
    "isPrinted" BOOLEAN NOT NULL DEFAULT false,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city" TEXT,
    "uf" VARCHAR(2),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleId" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccessAt" TIMESTAMP(3),
    "phone" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "permissions" "AdminPermission"[] DEFAULT ARRAY[]::"AdminPermission"[],

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableCents" INTEGER NOT NULL DEFAULT 0,
    "pendingCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" JSONB,
    "pickupPointId" TEXT,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" "SupportAuthorRole" NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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
    "pjRazaoSocial" TEXT NOT NULL,
    "pjCnpj" TEXT NOT NULL,
    "pjCep" TEXT,
    "pjLogradouro" TEXT,
    "pjNumero" TEXT,
    "pjComplemento" TEXT,
    "pjBairro" TEXT,
    "pjCidade" TEXT,
    "pjUf" VARCHAR(2),
    "vehiclePlate" TEXT NOT NULL,
    "vehicleBrand" TEXT NOT NULL,
    "vehicleModel" TEXT,
    "vehicleYear" TEXT,
    "commissionKind" "commission_kind" NOT NULL,
    "commissionAmount" DOUBLE PRECISION,
    "commissionAmountPerKm" DOUBLE PRECISION,
    "pickupFeeType" "pickup_fee_type" NOT NULL DEFAULT 'FIXED',
    "pickupFixedFee" DOUBLE PRECISION,
    "pickupFeePerKm" DOUBLE PRECISION,
    "bankMethodKind" "bank_method_kind" NOT NULL,
    "bankPixType" "pix_key_type",
    "bankPixKey" TEXT,
    "bankCode" TEXT,
    "bankBranch" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" "account_type",
    "bankHolderName" TEXT,
    "bankHolderCnpj" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pfCpf" TEXT,
    "pfEmail" TEXT,
    "pfEmailVerificationToken" TEXT,
    "pfEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "pfEmailVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "collectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "collector_credentials" (
    "id" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collector_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "cep_locations" (
    "cep" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precision" TEXT,
    "provider" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manual_override" BOOLEAN NOT NULL DEFAULT false,
    "manual_override_reason" TEXT,

    CONSTRAINT "cep_locations_pkey" PRIMARY KEY ("cep")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerificationToken_key" ON "users"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetPasswordToken_key" ON "users"("resetPasswordToken");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_emailVerificationToken_idx" ON "users"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "users_resetPasswordToken_idx" ON "users"("resetPasswordToken");

-- CreateIndex
CREATE INDEX "addresses_userId_role_idx" ON "addresses"("userId", "role");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE INDEX "addresses_cep_idx" ON "addresses"("cep");

-- CreateIndex
CREATE UNIQUE INDEX "cards_vaultToken_key" ON "cards"("vaultToken");

-- CreateIndex
CREATE INDEX "cards_userId_idx" ON "cards"("userId");

-- CreateIndex
CREATE INDEX "cards_userId_isDefault_idx" ON "cards"("userId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "cards_userId_fingerprint_key" ON "cards"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "recipients_userId_idx" ON "recipients"("userId");

-- CreateIndex
CREATE INDEX "recipients_userId_isDefault_idx" ON "recipients"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "recipients_userId_document_idx" ON "recipients"("userId", "document");

-- CreateIndex
CREATE INDEX "recipients_userId_name_idx" ON "recipients"("userId", "name");

-- CreateIndex
CREATE INDEX "recipients_userId_nameSearch_idx" ON "recipients"("userId", "nameSearch");

-- CreateIndex
CREATE INDEX "carts_userId_status_idx" ON "carts"("userId", "status");

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_platformTrackingCode_key" ON "shipments"("platformTrackingCode");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_publicTrackingId_key" ON "shipments"("publicTrackingId");

-- CreateIndex
CREATE INDEX "shipments_platformTrackingCode_idx" ON "shipments"("platformTrackingCode");

-- CreateIndex
CREATE INDEX "shipments_carrierTrackingCode_idx" ON "shipments"("carrierTrackingCode");

-- CreateIndex
CREATE INDEX "shipments_senderId_idx" ON "shipments"("senderId");

-- CreateIndex
CREATE INDEX "shipments_recipientId_idx" ON "shipments"("recipientId");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_publicTrackingId_idx" ON "shipments"("publicTrackingId");

-- CreateIndex
CREATE UNIQUE INDEX "labels_shipmentId_key" ON "labels"("shipmentId");

-- CreateIndex
CREATE INDEX "labels_shipmentId_idx" ON "labels"("shipmentId");

-- CreateIndex
CREATE INDEX "labels_status_idx" ON "labels"("status");

-- CreateIndex
CREATE INDEX "labels_isPrinted_idx" ON "labels"("isPrinted");

-- CreateIndex
CREATE INDEX "labels_createdAt_idx" ON "labels"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_requests_shipmentId_key" ON "pickup_requests"("shipmentId");

-- CreateIndex
CREATE INDEX "pickup_requests_userId_idx" ON "pickup_requests"("userId");

-- CreateIndex
CREATE INDEX "pickup_requests_shipmentId_idx" ON "pickup_requests"("shipmentId");

-- CreateIndex
CREATE INDEX "pickup_requests_status_idx" ON "pickup_requests"("status");

-- CreateIndex
CREATE INDEX "pickup_requests_createdAt_idx" ON "pickup_requests"("createdAt");

-- CreateIndex
CREATE INDEX "pickup_requests_originCep_idx" ON "pickup_requests"("originCep");

-- CreateIndex
CREATE INDEX "tracking_events_shipmentId_idx" ON "tracking_events"("shipmentId");

-- CreateIndex
CREATE INDEX "tracking_events_occurredAt_idx" ON "tracking_events"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "staff_roles_name_key" ON "staff_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "staff_users_email_idx" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "staff_audit_logs_actorId_idx" ON "staff_audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "staff_audit_logs_entity_entityId_idx" ON "staff_audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "staff_audit_logs_createdAt_idx" ON "staff_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "user_security_events_userId_idx" ON "user_security_events"("userId");

-- CreateIndex
CREATE INDEX "user_security_events_userId_type_idx" ON "user_security_events"("userId", "type");

-- CreateIndex
CREATE INDEX "user_security_events_createdAt_idx" ON "user_security_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_tokenHash_idx" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_referenceId_key" ON "wallet_transactions"("referenceId");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_status_createdAt_idx" ON "wallet_transactions"("walletId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_referenceId_idx" ON "wallet_transactions"("referenceId");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_createdAt_idx" ON "support_tickets"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_userId_createdAt_idx" ON "support_tickets"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_pickupPointId_createdAt_idx" ON "support_tickets"("pickupPointId", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_assignedTo_idx" ON "support_tickets"("assignedTo");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_createdAt_idx" ON "support_messages"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "support_attachments_messageId_idx" ON "support_attachments"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_points_cnpj_key" ON "pickup_points"("cnpj");

-- CreateIndex
CREATE INDEX "pickup_points_status_idx" ON "pickup_points"("status");

-- CreateIndex
CREATE INDEX "pickup_points_uf_cidade_idx" ON "pickup_points"("uf", "cidade");

-- CreateIndex
CREATE INDEX "pickup_points_cnpj_idx" ON "pickup_points"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "receptions_trackingCode_key" ON "receptions"("trackingCode");

-- CreateIndex
CREATE INDEX "receptions_pickupPointId_status_idx" ON "receptions"("pickupPointId", "status");

-- CreateIndex
CREATE INDEX "receptions_pickupPointId_receivedAt_idx" ON "receptions"("pickupPointId", "receivedAt");

-- CreateIndex
CREATE INDEX "receptions_trackingCode_idx" ON "receptions"("trackingCode");

-- CreateIndex
CREATE INDEX "receptions_status_idx" ON "receptions"("status");

-- CreateIndex
CREATE INDEX "quotes_userId_status_createdAt_idx" ON "quotes"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "quotes_userId_createdAt_idx" ON "quotes"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "quotes_status_expiresAt_idx" ON "quotes"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "quote_volumes_quoteId_idx" ON "quote_volumes"("quoteId");

-- CreateIndex
CREATE INDEX "quote_options_quoteId_idx" ON "quote_options"("quoteId");

-- CreateIndex
CREATE INDEX "quote_options_quoteId_totalCents_idx" ON "quote_options"("quoteId", "totalCents");

-- CreateIndex
CREATE UNIQUE INDEX "quote_selections_quoteId_key" ON "quote_selections"("quoteId");

-- CreateIndex
CREATE INDEX "quote_selections_quoteId_idx" ON "quote_selections"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "carriers_slug_key" ON "carriers"("slug");

-- CreateIndex
CREATE INDEX "carriers_slug_idx" ON "carriers"("slug");

-- CreateIndex
CREATE INDEX "carriers_status_idx" ON "carriers"("status");

-- CreateIndex
CREATE INDEX "carrier_services_carrierId_isActive_idx" ON "carrier_services"("carrierId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_services_carrierId_serviceId_key" ON "carrier_services"("carrierId", "serviceId");

-- CreateIndex
CREATE INDEX "carrier_endpoints_carrierId_idx" ON "carrier_endpoints"("carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_endpoints_carrierId_operation_key" ON "carrier_endpoints"("carrierId", "operation");

-- CreateIndex
CREATE INDEX "carrier_credentials_carrierId_environment_isActive_idx" ON "carrier_credentials"("carrierId", "environment", "isActive");

-- CreateIndex
CREATE INDEX "carrier_pricing_rules_carrierId_isActive_priority_idx" ON "carrier_pricing_rules"("carrierId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "carrier_webhooks_carrierId_status_nextRetryAt_idx" ON "carrier_webhooks"("carrierId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "carrier_webhooks_externalId_idx" ON "carrier_webhooks"("externalId");

-- CreateIndex
CREATE INDEX "carrier_webhooks_createdAt_idx" ON "carrier_webhooks"("createdAt");

-- CreateIndex
CREATE INDEX "carrier_health_checks_carrierId_checkedAt_idx" ON "carrier_health_checks"("carrierId", "checkedAt");

-- CreateIndex
CREATE INDEX "carrier_api_calls_carrierId_operation_startedAt_idx" ON "carrier_api_calls"("carrierId", "operation", "startedAt");

-- CreateIndex
CREATE INDEX "carrier_api_calls_success_startedAt_idx" ON "carrier_api_calls"("success", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateways_slug_key" ON "payment_gateways"("slug");

-- CreateIndex
CREATE INDEX "payment_gateways_slug_idx" ON "payment_gateways"("slug");

-- CreateIndex
CREATE INDEX "payment_gateways_status_idx" ON "payment_gateways"("status");

-- CreateIndex
CREATE INDEX "payment_credentials_gatewayId_environment_isActive_idx" ON "payment_credentials"("gatewayId", "environment", "isActive");

-- CreateIndex
CREATE INDEX "payment_endpoints_gatewayId_idx" ON "payment_endpoints"("gatewayId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_endpoints_gatewayId_operation_key" ON "payment_endpoints"("gatewayId", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_referenceId_key" ON "payment_transactions"("referenceId");

-- CreateIndex
CREATE INDEX "payment_transactions_gatewayId_status_createdAt_idx" ON "payment_transactions"("gatewayId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_transactions_userId_status_idx" ON "payment_transactions"("userId", "status");

-- CreateIndex
CREATE INDEX "payment_transactions_referenceId_idx" ON "payment_transactions"("referenceId");

-- CreateIndex
CREATE INDEX "payment_transactions_externalId_idx" ON "payment_transactions"("externalId");

-- CreateIndex
CREATE INDEX "payment_refunds_transactionId_idx" ON "payment_refunds"("transactionId");

-- CreateIndex
CREATE INDEX "payment_chargebacks_transactionId_idx" ON "payment_chargebacks"("transactionId");

-- CreateIndex
CREATE INDEX "payment_webhooks_gatewayId_status_nextRetryAt_idx" ON "payment_webhooks"("gatewayId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "payment_webhooks_externalId_idx" ON "payment_webhooks"("externalId");

-- CreateIndex
CREATE INDEX "payment_webhooks_createdAt_idx" ON "payment_webhooks"("createdAt");

-- CreateIndex
CREATE INDEX "payment_health_checks_gatewayId_checkedAt_idx" ON "payment_health_checks"("gatewayId", "checkedAt");

-- CreateIndex
CREATE INDEX "ledger_entries_accountType_accountId_createdAt_idx" ON "ledger_entries"("accountType", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");

-- CreateIndex
CREATE INDEX "ledger_entries_type_createdAt_idx" ON "ledger_entries"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "collectors_pjCnpj_key" ON "collectors"("pjCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "collectors_pfCpf_key" ON "collectors"("pfCpf");

-- CreateIndex
CREATE UNIQUE INDEX "collectors_pfEmail_key" ON "collectors"("pfEmail");

-- CreateIndex
CREATE UNIQUE INDEX "collectors_pfEmailVerificationToken_key" ON "collectors"("pfEmailVerificationToken");

-- CreateIndex
CREATE INDEX "collectors_status_idx" ON "collectors"("status");

-- CreateIndex
CREATE INDEX "collectors_pfCpf_idx" ON "collectors"("pfCpf");

-- CreateIndex
CREATE INDEX "collectors_pfEmail_idx" ON "collectors"("pfEmail");

-- CreateIndex
CREATE INDEX "collectors_pjCnpj_idx" ON "collectors"("pjCnpj");

-- CreateIndex
CREATE INDEX "collectors_pfCidade_pfUf_idx" ON "collectors"("pfCidade", "pfUf");

-- CreateIndex
CREATE INDEX "collectors_pjCidade_pjUf_idx" ON "collectors"("pjCidade", "pjUf");

-- CreateIndex
CREATE INDEX "collector_documents_collectorId_type_idx" ON "collector_documents"("collectorId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "collector_documents_collectorId_type_key" ON "collector_documents"("collectorId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "collector_credentials_collectorId_key" ON "collector_credentials"("collectorId");

-- CreateIndex
CREATE INDEX "packaging_templates_userId_idx" ON "packaging_templates"("userId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_requests" ADD CONSTRAINT "pickup_requests_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "staff_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_audit_logs" ADD CONSTRAINT "staff_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_security_events" ADD CONSTRAINT "user_security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "pickup_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "support_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "pickup_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_volumes" ADD CONSTRAINT "quote_volumes_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_selections" ADD CONSTRAINT "quote_selections_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_services" ADD CONSTRAINT "carrier_services_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_endpoints" ADD CONSTRAINT "carrier_endpoints_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_credentials" ADD CONSTRAINT "carrier_credentials_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_pricing_rules" ADD CONSTRAINT "carrier_pricing_rules_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_webhooks" ADD CONSTRAINT "carrier_webhooks_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_health_checks" ADD CONSTRAINT "carrier_health_checks_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_api_calls" ADD CONSTRAINT "carrier_api_calls_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_credentials" ADD CONSTRAINT "payment_credentials_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_endpoints" ADD CONSTRAINT "payment_endpoints_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_chargebacks" ADD CONSTRAINT "payment_chargebacks_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhooks" ADD CONSTRAINT "payment_webhooks_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_health_checks" ADD CONSTRAINT "payment_health_checks_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_documents" ADD CONSTRAINT "collector_documents_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "collectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_credentials" ADD CONSTRAINT "collector_credentials_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "collectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_templates" ADD CONSTRAINT "packaging_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

