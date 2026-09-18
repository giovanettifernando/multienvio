-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AdminPermission" AS ENUM ('CONTAS', 'FINANCEIRO', 'OPERACOES', 'INTEGRACOES', 'SUPORTE', 'USUARIOS', 'CONFIGURACOES');

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
CREATE TYPE "EmailConfigStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "recipient_payment_status" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "correios_agency_type" AS ENUM ('AC', 'ACF', 'AGF', 'CDD', 'CTE', 'CTCE', 'CEE', 'CTCI', 'OUTROS');

-- CreateEnum
CREATE TYPE "correios_agency_status" AS ENUM ('ATIVA', 'INATIVA', 'OUTRO');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('INFRAESTRUTURA', 'SOFTWARE', 'GATEWAY', 'MARKETING', 'PESSOAL', 'ADMINISTRATIVO', 'LOGISTICA', 'IMPOSTOS', 'OUTROS');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "faq_audience" AS ENUM ('USER');

-- CreateEnum
CREATE TYPE "AssistantMessageAuthor" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerificationToken" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "googleId" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'email',
    "asaasCustomerId" TEXT,
    "cpf" TEXT,
    "cnpj" TEXT,
    "hasCompany" BOOLEAN NOT NULL DEFAULT false,
    "razaoSocial" TEXT,
    "passwordUpdatedAt" TIMESTAMP(3),
    "passwordHistory" JSONB,

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
    "selectedQuote" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "document" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "platformTrackingCode" TEXT NOT NULL,
    "carrierTrackingCode" TEXT,
    "carrierMetadata" JSONB,
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
    "status" TEXT NOT NULL DEFAULT 'AWAITING_DROP_OFF_AT_POINT',
    "carrier" TEXT,
    "service" TEXT,
    "originCep" TEXT NOT NULL,
    "originAddress" TEXT,
    "originNeighborhood" TEXT,
    "originCity" TEXT,
    "originState" TEXT,
    "senderName" TEXT,
    "senderDocument" TEXT,
    "dceKey" TEXT,
    "destinationCep" TEXT NOT NULL,
    "estimatedDays" INTEGER,
    "freightCost" DOUBLE PRECISION,
    "document" JSONB,
    "paymentMethod" TEXT,
    "publicTrackingId" TEXT,
    "postedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platform_shipping_commission_cents" INTEGER,
    "platform_insurance_commission_cents" INTEGER,

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
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "packageNumber" INTEGER NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "carrierTrackingCode" TEXT,
    "carrierPrePostageId" TEXT,
    "carrierQuotePrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
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
    "shipping_commission_percent" DECIMAL(5,2),
    "insurance_commission_percent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
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
    "applicationId" TEXT,
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
    "consumedByReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
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
CREATE TABLE "email_configs" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "status" "EmailConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_oauth_configs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_oauth_configs_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "correios_agencies" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "correios_agency_status" NOT NULL DEFAULT 'ATIVA',
    "status_codigo" INTEGER NOT NULL DEFAULT 2,
    "status_descricao" TEXT,
    "tipo_unidade_codigo" TEXT NOT NULL,
    "tipo_unidade_descricao" TEXT,
    "tipo_unidade_sigla" "correios_agency_type" NOT NULL DEFAULT 'OUTROS',
    "cep" VARCHAR(8) NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "municipio" TEXT NOT NULL,
    "bairro" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "horario_funcionamento" TEXT,
    "ini_expediente" TEXT,
    "fim_expediente" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "correios_agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_unitario" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_commissions" (
    "id" TEXT NOT NULL,
    "shipping_commission_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "reference" TEXT,
    "supplier" TEXT,
    "notes" TEXT,
    "dre_account_code" TEXT,
    "receipt_url" TEXT,
    "receipt_file_name" TEXT,
    "receipt_uploaded_at" TIMESTAMP(3),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_months" INTEGER,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "supplier" TEXT,
    "default_amount" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "audience" "faq_audience" NOT NULL DEFAULT 'USER',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpful_yes" INTEGER NOT NULL DEFAULT 0,
    "helpful_no" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_code_reservations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shipment_id" TEXT,
    "used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_code_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipient_payment_requests" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "origin_address_id" TEXT,
    "origin_cep" VARCHAR(8) NOT NULL,
    "origin_city" TEXT NOT NULL,
    "origin_state" VARCHAR(2) NOT NULL,
    "origin_address" TEXT,
    "origin_neighborhood" TEXT,
    "origin_number" TEXT,
    "origin_complement" TEXT,
    "recipient_name" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_phone" TEXT,
    "recipient_document" TEXT,
    "destination_cep" VARCHAR(8) NOT NULL,
    "destination_city" TEXT NOT NULL,
    "destination_state" VARCHAR(2) NOT NULL,
    "destination_address" TEXT,
    "destination_neighborhood" TEXT,
    "destination_number" TEXT,
    "destination_complement" TEXT,
    "total_weight" DOUBLE PRECISION NOT NULL,
    "declared_value" DOUBLE PRECISION NOT NULL,
    "carrier" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "service_code" TEXT,
    "estimated_days" INTEGER,
    "freight_cost_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "shipping_commission_cents" INTEGER,
    "document" JSONB,
    "payment_token" TEXT NOT NULL,
    "status" "recipient_payment_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "shipment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipient_payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipient_payment_packages" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "package_number" INTEGER NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "recipient_payment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "openrouter_configs" (
    "id" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "base_url" TEXT NOT NULL DEFAULT 'https://openrouter.ai/api/v1',
    "default_model" TEXT NOT NULL DEFAULT 'anthropic/claude-3-haiku',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 2048,
    "streaming_enabled" BOOLEAN NOT NULL DEFAULT true,
    "http_referer" TEXT,
    "x_title" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "openrouter_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "author" "AssistantMessageAuthor" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_name" TEXT,
    "tool_args" JSONB,
    "tool_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_markdown" TEXT NOT NULL,
    "tags" TEXT[],
    "category" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "job_id" TEXT,
    "reference_id" TEXT,
    "file_name" TEXT,
    "file_path" TEXT,
    "content_type" TEXT DEFAULT 'application/pdf',
    "size_bytes" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerificationToken_key" ON "users"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

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
CREATE UNIQUE INDEX "shipments_dceKey_key" ON "shipments"("dceKey");

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
CREATE INDEX "shipments_senderId_status_idx" ON "shipments"("senderId", "status");

-- CreateIndex
CREATE INDEX "shipments_createdAt_idx" ON "shipments"("createdAt");

-- CreateIndex
CREATE INDEX "shipments_senderId_status_createdAt_idx" ON "shipments"("senderId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "labels_shipmentId_key" ON "labels"("shipmentId");

-- CreateIndex
CREATE INDEX "labels_status_idx" ON "labels"("status");

-- CreateIndex
CREATE INDEX "labels_isPrinted_idx" ON "labels"("isPrinted");

-- CreateIndex
CREATE INDEX "labels_createdAt_idx" ON "labels"("createdAt");

-- CreateIndex
CREATE INDEX "labels_status_isPrinted_idx" ON "labels"("status", "isPrinted");

-- CreateIndex
CREATE INDEX "labels_trackingCode_idx" ON "labels"("trackingCode");

-- CreateIndex
CREATE INDEX "packages_shipmentId_idx" ON "packages"("shipmentId");

-- CreateIndex
CREATE INDEX "packages_carrierTrackingCode_idx" ON "packages"("carrierTrackingCode");

-- CreateIndex
CREATE UNIQUE INDEX "packages_shipmentId_packageNumber_key" ON "packages"("shipmentId", "packageNumber");

-- CreateIndex
CREATE INDEX "tracking_events_shipmentId_occurredAt_idx" ON "tracking_events"("shipmentId", "occurredAt");

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
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_referenceId_key" ON "wallet_transactions"("referenceId");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_status_createdAt_idx" ON "wallet_transactions"("walletId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_referenceId_idx" ON "wallet_transactions"("referenceId");

-- CreateIndex
CREATE INDEX "wallet_transactions_status_confirmedAt_idx" ON "wallet_transactions"("status", "confirmedAt");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_createdAt_idx" ON "support_tickets"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_userId_createdAt_idx" ON "support_tickets"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_assignedTo_idx" ON "support_tickets"("assignedTo");

-- CreateIndex
CREATE INDEX "support_tickets_lastActivityAt_idx" ON "support_tickets"("lastActivityAt");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_createdAt_idx" ON "support_messages"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "support_attachments_messageId_idx" ON "support_attachments"("messageId");

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
CREATE INDEX "carrier_credentials_carrierId_environment_isActive_idx" ON "carrier_credentials"("carrierId", "environment", "isActive");

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
CREATE INDEX "payment_transactions_paidAt_idx" ON "payment_transactions"("paidAt");

-- CreateIndex
CREATE INDEX "payment_webhooks_gatewayId_status_nextRetryAt_idx" ON "payment_webhooks"("gatewayId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "payment_webhooks_externalId_idx" ON "payment_webhooks"("externalId");

-- CreateIndex
CREATE INDEX "payment_webhooks_createdAt_idx" ON "payment_webhooks"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhooks_gatewayId_externalId_key" ON "payment_webhooks"("gatewayId", "externalId");

-- CreateIndex
CREATE INDEX "ledger_entries_accountType_accountId_createdAt_idx" ON "ledger_entries"("accountType", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_type_createdAt_idx" ON "ledger_entries"("type", "createdAt");

-- CreateIndex
CREATE INDEX "packaging_templates_userId_idx" ON "packaging_templates"("userId");

-- CreateIndex
CREATE INDEX "correios_agencies_uf_municipio_idx" ON "correios_agencies"("uf", "municipio");

-- CreateIndex
CREATE INDEX "correios_agencies_cep_idx" ON "correios_agencies"("cep");

-- CreateIndex
CREATE INDEX "correios_agencies_status_idx" ON "correios_agencies"("status");

-- CreateIndex
CREATE INDEX "correios_agencies_tipo_unidade_sigla_status_idx" ON "correios_agencies"("tipo_unidade_sigla", "status");

-- CreateIndex
CREATE INDEX "recurring_items_user_id_idx" ON "recurring_items"("user_id");

-- CreateIndex
CREATE INDEX "expenses_type_status_created_at_idx" ON "expenses"("type", "status", "created_at");

-- CreateIndex
CREATE INDEX "expenses_category_created_at_idx" ON "expenses"("category", "created_at");

-- CreateIndex
CREATE INDEX "expenses_due_date_idx" ON "expenses"("due_date");

-- CreateIndex
CREATE INDEX "expenses_created_by_idx" ON "expenses"("created_by");

-- CreateIndex
CREATE INDEX "expenses_dre_account_code_created_at_idx" ON "expenses"("dre_account_code", "created_at");

-- CreateIndex
CREATE INDEX "expense_templates_category_is_active_idx" ON "expense_templates"("category", "is_active");

-- CreateIndex
CREATE INDEX "expense_templates_is_active_usage_count_idx" ON "expense_templates"("is_active", "usage_count");

-- CreateIndex
CREATE UNIQUE INDEX "expense_templates_name_category_key" ON "expense_templates"("name", "category");

-- CreateIndex
CREATE INDEX "faq_items_audience_is_active_sort_order_idx" ON "faq_items"("audience", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "faq_items_category_is_active_idx" ON "faq_items"("category", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_code_reservations_code_key" ON "tracking_code_reservations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_code_reservations_shipment_id_key" ON "tracking_code_reservations"("shipment_id");

-- CreateIndex
CREATE INDEX "tracking_code_reservations_user_id_idx" ON "tracking_code_reservations"("user_id");

-- CreateIndex
CREATE INDEX "tracking_code_reservations_expires_at_idx" ON "tracking_code_reservations"("expires_at");

-- CreateIndex
CREATE INDEX "tracking_code_reservations_used_at_idx" ON "tracking_code_reservations"("used_at");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_payment_requests_payment_token_key" ON "recipient_payment_requests"("payment_token");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_payment_requests_shipment_id_key" ON "recipient_payment_requests"("shipment_id");

-- CreateIndex
CREATE INDEX "recipient_payment_requests_sender_id_idx" ON "recipient_payment_requests"("sender_id");

-- CreateIndex
CREATE INDEX "recipient_payment_requests_payment_token_idx" ON "recipient_payment_requests"("payment_token");

-- CreateIndex
CREATE INDEX "recipient_payment_requests_status_idx" ON "recipient_payment_requests"("status");

-- CreateIndex
CREATE INDEX "recipient_payment_requests_expires_at_idx" ON "recipient_payment_requests"("expires_at");

-- CreateIndex
CREATE INDEX "recipient_payment_requests_sender_id_status_idx" ON "recipient_payment_requests"("sender_id", "status");

-- CreateIndex
CREATE INDEX "recipient_payment_packages_request_id_idx" ON "recipient_payment_packages"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_payment_packages_request_id_package_number_key" ON "recipient_payment_packages"("request_id", "package_number");

-- CreateIndex
CREATE INDEX "assistant_chat_sessions_user_id_idx" ON "assistant_chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "assistant_chat_sessions_user_id_updated_at_idx" ON "assistant_chat_sessions"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "assistant_chat_messages_session_id_idx" ON "assistant_chat_messages"("session_id");

-- CreateIndex
CREATE INDEX "assistant_chat_messages_session_id_created_at_idx" ON "assistant_chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_base_articles_slug_key" ON "knowledge_base_articles"("slug");

-- CreateIndex
CREATE INDEX "knowledge_base_articles_is_published_idx" ON "knowledge_base_articles"("is_published");

-- CreateIndex
CREATE INDEX "knowledge_base_articles_category_idx" ON "knowledge_base_articles"("category");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "generated_documents_job_id_key" ON "generated_documents"("job_id");

-- CreateIndex
CREATE INDEX "generated_documents_user_id_status_idx" ON "generated_documents"("user_id", "status");

-- CreateIndex
CREATE INDEX "generated_documents_user_id_document_type_created_at_idx" ON "generated_documents"("user_id", "document_type", "created_at");

-- CreateIndex
CREATE INDEX "generated_documents_expires_at_idx" ON "generated_documents"("expires_at");

-- CreateIndex
CREATE INDEX "generated_documents_reference_id_document_type_idx" ON "generated_documents"("reference_id", "document_type");

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
ALTER TABLE "packages" ADD CONSTRAINT "packages_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "support_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_volumes" ADD CONSTRAINT "quote_volumes_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_selections" ADD CONSTRAINT "quote_selections_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_credentials" ADD CONSTRAINT "carrier_credentials_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_credentials" ADD CONSTRAINT "payment_credentials_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_endpoints" ADD CONSTRAINT "payment_endpoints_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhooks" ADD CONSTRAINT "payment_webhooks_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_templates" ADD CONSTRAINT "packaging_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_code_reservations" ADD CONSTRAINT "tracking_code_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_payment_requests" ADD CONSTRAINT "recipient_payment_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_payment_requests" ADD CONSTRAINT "recipient_payment_requests_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_payment_packages" ADD CONSTRAINT "recipient_payment_packages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "recipient_payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_chat_sessions" ADD CONSTRAINT "assistant_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_chat_messages" ADD CONSTRAINT "assistant_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "assistant_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
