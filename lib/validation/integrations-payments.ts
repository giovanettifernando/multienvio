import { z } from 'zod';
import {
  integrationEnvironmentSchema,
  integrationStatusSchema,
  authTypeSchema,
} from './integrations-carriers';

/**
 * Validation schemas for payment gateway integrations
 */

// Enums
export const paymentMethodSchema = z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'WALLET']);
export const transactionStatusSchema = z.enum([
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'PAID',
  'REFUNDED',
  'CHARGEBACK',
  'CANCELED',
  'FAILED',
]);
export const ledgerEntryTypeSchema = z.enum([
  'CHARGE',
  'REFUND',
  'CHARGEBACK',
  'FEE',
  'PAYOUT',
  'ADJUSTMENT',
]);

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;

// Payment Gateway schemas
export const createPaymentGatewaySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Slug inválido'),
  status: integrationStatusSchema.default('ACTIVE'),
  environment: integrationEnvironmentSchema.default('PRODUCTION'),
  baseUrl: z.string().url('URL inválida').nullable().optional(),
  timeout: z.coerce.number().int().min(1000).max(300000).default(30000),
  enabledMethods: z.array(paymentMethodSchema).default([]),
  logoUrl: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const updatePaymentGatewaySchema = createPaymentGatewaySchema.partial();

export type CreatePaymentGatewayInput = z.infer<typeof createPaymentGatewaySchema>;
export type UpdatePaymentGatewayInput = z.infer<typeof updatePaymentGatewaySchema>;

// Payment Credential schemas
export const createPaymentCredentialSchema = z.object({
  gatewayId: z.string().cuid(),
  environment: integrationEnvironmentSchema,
  authType: authTypeSchema,
  merchantId: z.string().nullable().optional(),
  apiKey: z.string().nullable().optional(),
  publicKey: z.string().nullable().optional(),
  secretKey: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  clientSecret: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updatePaymentCredentialSchema = createPaymentCredentialSchema.omit({ gatewayId: true }).partial();

export type CreatePaymentCredentialInput = z.infer<typeof createPaymentCredentialSchema>;
export type UpdatePaymentCredentialInput = z.infer<typeof updatePaymentCredentialSchema>;

// Payment Endpoint schemas
export const createPaymentEndpointSchema = z.object({
  gatewayId: z.string().cuid(),
  operation: z.enum(['charge', 'authorize', 'capture', 'refund', 'cancel', 'check_status', 'create_pix', 'create_boleto']),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  path: z.string().min(1, 'Path é obrigatório'),
  timeout: z.coerce.number().int().min(1000).max(300000).nullable().optional(),
  retryable: z.boolean().default(true),
  requestMapping: z.record(z.string(), z.unknown()).nullable().optional(),
  responseMapping: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updatePaymentEndpointSchema = createPaymentEndpointSchema.omit({ gatewayId: true }).partial();

export type CreatePaymentEndpointInput = z.infer<typeof createPaymentEndpointSchema>;
export type UpdatePaymentEndpointInput = z.infer<typeof updatePaymentEndpointSchema>;

// Payment Transaction schemas
export const createPaymentTransactionSchema = z.object({
  gatewayId: z.string().cuid(),
  referenceId: z.string().min(1, 'Reference ID é obrigatório'),
  userId: z.string().cuid().nullable().optional(),
  method: paymentMethodSchema,
  amountCents: z.coerce.number().int().min(0, 'Valor deve ser positivo'),
  // Card data (for CREDIT_CARD/DEBIT_CARD)
  cardBrand: z.string().nullable().optional(),
  cardLast4: z.string().length(4).nullable().optional(),
  // Pix data
  pixKey: z.string().nullable().optional(),
  // Boleto data
  boletoUrl: z.string().url().nullable().optional(),
  boletoBarcode: z.string().nullable().optional(),
  // Metadata
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updatePaymentTransactionSchema = z.object({
  status: transactionStatusSchema,
  externalId: z.string().nullable().optional(),
  feeCents: z.coerce.number().int().min(0).nullable().optional(),
  netCents: z.coerce.number().int().nullable().optional(),
  pixQrCode: z.string().nullable().optional(),
});

export type CreatePaymentTransactionInput = z.infer<typeof createPaymentTransactionSchema>;
export type UpdatePaymentTransactionInput = z.infer<typeof updatePaymentTransactionSchema>;

// Ledger Entry schemas
export const createLedgerEntrySchema = z.object({
  type: ledgerEntryTypeSchema,
  amountCents: z.coerce.number().int(), // Pode ser negativo
  accountType: z.enum(['platform', 'user_wallet', 'partner_payout']),
  accountId: z.string().nullable().optional(),
  description: z.string().min(1, 'Descrição é obrigatória'),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type CreateLedgerEntryInput = z.infer<typeof createLedgerEntrySchema>;

// Webhook processing schemas
export const processPaymentWebhookSchema = z.object({
  gatewayId: z.string().cuid(),
  eventType: z.string().min(1),
  externalId: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()),
  signature: z.string().nullable().optional(),
});

export type ProcessPaymentWebhookInput = z.infer<typeof processPaymentWebhookSchema>;

// List queries
export const listPaymentGatewaysQuerySchema = z.object({
  status: integrationStatusSchema.optional(),
  environment: integrationEnvironmentSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listTransactionsQuerySchema = z.object({
  gatewayId: z.string().cuid().optional(),
  userId: z.string().cuid().optional(),
  status: transactionStatusSchema.optional(),
  method: paymentMethodSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListPaymentGatewaysQuery = z.infer<typeof listPaymentGatewaysQuerySchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

// Business rules validation
export const validatePaymentRules = {
  /**
   * Validates if payment method is enabled for gateway
   */
  isMethodEnabled(enabledMethods: PaymentMethod[], method: PaymentMethod): boolean {
    return enabledMethods.includes(method);
  },

  /**
   * Validates if transaction can be canceled
   */
  canCancel(status: TransactionStatus): boolean {
    return status === 'PENDING' || status === 'AUTHORIZED';
  },

  /**
   * Calculates net amount (amount - fee)
   */
  calculateNetAmount(amountCents: number, feeCents: number): number {
    return amountCents - feeCents;
  },

  /**
   * Validates webhook retry policy
   */
  shouldRetryWebhook(retryCount: number, maxRetries: number): boolean {
    return retryCount < maxRetries;
  },

  /**
   * Calculates next retry time with exponential backoff
   */
  calculateNextRetry(retryCount: number): Date {
    const baseDelay = 60000; // 1 minute
    const maxDelay = 3600000; // 1 hour
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    return new Date(Date.now() + delay);
  },
};

// Helper functions for field masking
export function maskPaymentCredentials(credential: unknown): unknown {
  const cred = credential as Record<string, unknown>;
  return {
    ...cred,
    apiKey: cred.apiKey ? '****** (hidden)' : null,
    secretKey: cred.secretKey ? '****** (hidden)' : null,
    clientSecret: cred.clientSecret ? '****** (hidden)' : null,
    accessToken: cred.accessToken ? '****** (hidden)' : null,
    refreshToken: cred.refreshToken ? '****** (hidden)' : null,
  };
}
