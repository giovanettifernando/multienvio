import { prisma } from '@/platform/db/db';
import { PaymentMethod, Prisma } from '@prisma/client';
import type {
  CreatePaymentTransactionInput,
  UpdatePaymentTransactionInput,
  ListTransactionsQuery,
  TransactionStatus,
} from '@/shared/validation/integrations-payments';
import { validatePaymentRules } from '@/shared/validation/integrations-payments';
import type { PaymentTransaction } from '@prisma/client';

/**
 * Service for managing payment transactions
 */

export type PaginatedTransactions = {
  transactions: PaymentTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

/**
 * Create payment transaction
 */
export async function createPaymentTransaction(
  data: CreatePaymentTransactionInput
): Promise<PaymentTransaction> {
  // Verify gateway exists
  const gateway = await prisma.paymentGateway.findUnique({
    where: { id: data.gatewayId },
  });

  if (!gateway) {
    throw new Error('Payment gateway not found');
  }

  // Validate payment method is enabled
  if (!validatePaymentRules.isMethodEnabled(gateway.enabledMethods as PaymentMethod[], data.method)) {
    throw new Error(`Payment method ${data.method} is not enabled for this gateway`);
  }

  // Create transaction
  const transaction = await prisma.paymentTransaction.create({
    data: {
      gatewayId: data.gatewayId,
      referenceId: data.referenceId,
      userId: data.userId || null,
      status: 'PENDING',
      method: data.method,
      amountCents: data.amountCents,
      feeCents: 0,
      netCents: data.amountCents,
      // Card data
      cardBrand: data.cardBrand || null,
      cardLast4: data.cardLast4 || null,
      // Pix data
      pixKey: data.pixKey || null,
      pixQrCode: null,
      // Boleto data
      boletoUrl: data.boletoUrl || null,
      boletoBarcode: data.boletoBarcode || null,
      // Metadata
      metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  return transaction;
}

/**
 * Update payment transaction
 */
export async function updatePaymentTransaction(
  id: string,
  data: UpdatePaymentTransactionInput
): Promise<PaymentTransaction> {
  const existing = await prisma.paymentTransaction.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Transaction not found');
  }

  // Calculate net amount if fee is provided
  let netCents = data.netCents;
  if (data.feeCents !== undefined && data.feeCents !== null && !data.netCents) {
    netCents = validatePaymentRules.calculateNetAmount(existing.amountCents, data.feeCents);
  }

  const transaction = await prisma.paymentTransaction.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
      ...(data.feeCents !== undefined && data.feeCents !== null ? { feeCents: data.feeCents } : {}),
      ...(netCents !== undefined && netCents !== null ? { netCents } : {}),
      ...(data.pixQrCode !== undefined ? { pixQrCode: data.pixQrCode } : {}),
      ...(data.status === 'PAID' ? { paidAt: new Date() } : {}),
    },
  });

  return transaction;
}

/**
 * Get transaction by ID
 */
export async function getPaymentTransaction(id: string): Promise<
  | (PaymentTransaction & {
      gateway: {
        id: string;
        name: string;
        slug: string;
      };
      user: {
        id: string;
        name: string | null;
        email: string;
      } | null;
    })
  | null
> {
  return await prisma.paymentTransaction.findUnique({
    where: { id },
    include: {
      gateway: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Get transaction by reference ID
 */
export async function getPaymentTransactionByReference(
  referenceId: string
): Promise<PaymentTransaction | null> {
  return await prisma.paymentTransaction.findUnique({
    where: { referenceId },
  });
}

/**
 * Get transaction by external ID (from gateway)
 */
export async function getPaymentTransactionByExternalId(
  externalId: string
): Promise<PaymentTransaction | null> {
  return await prisma.paymentTransaction.findFirst({
    where: { externalId },
  });
}

/**
 * List transactions with pagination and filters
 */
export async function listPaymentTransactions(
  query: ListTransactionsQuery
): Promise<PaginatedTransactions> {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const where: {
    gatewayId?: string;
    userId?: string;
    status?: TransactionStatus;
    method?: PaymentMethod;
    createdAt?: {
      gte?: Date;
      lte?: Date;
    };
  } = {};

  if (query.gatewayId) where.gatewayId = query.gatewayId;
  if (query.userId) where.userId = query.userId;
  if (query.status) where.status = query.status;
  if (query.method) where.method = query.method as PaymentMethod;

  // Date filtering
  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) {
      where.createdAt.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      where.createdAt.lte = new Date(query.endDate);
    }
  }

  const [transactions, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.paymentTransaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Authorize transaction (for credit card)
 */
export async function authorizeTransaction(id: string): Promise<PaymentTransaction> {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.status !== 'PENDING') {
    throw new Error('Only pending transactions can be authorized');
  }

  return await updatePaymentTransaction(id, {
    status: 'AUTHORIZED',
  });
}

/**
 * Capture transaction (complete payment after authorization)
 */
export async function captureTransaction(id: string): Promise<PaymentTransaction> {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.status !== 'AUTHORIZED') {
    throw new Error('Only authorized transactions can be captured');
  }

  return await updatePaymentTransaction(id, {
    status: 'CAPTURED',
  });
}

/**
 * Mark transaction as paid
 */
export async function markTransactionPaid(id: string): Promise<PaymentTransaction> {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (!['PENDING', 'AUTHORIZED', 'CAPTURED'].includes(transaction.status)) {
    throw new Error(`Cannot mark transaction as paid from status: ${transaction.status}`);
  }

  return await updatePaymentTransaction(id, {
    status: 'PAID',
  });
}

/**
 * Cancel transaction
 */
export async function cancelTransaction(id: string): Promise<PaymentTransaction> {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (!validatePaymentRules.canCancel(transaction.status as TransactionStatus)) {
    throw new Error(`Cannot cancel transaction with status: ${transaction.status}`);
  }

  return await updatePaymentTransaction(id, {
    status: 'CANCELED',
  });
}

/**
 * Mark transaction as failed
 */
export async function failTransaction(
  id: string,
  errorMessage?: string
): Promise<PaymentTransaction> {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Update metadata with error message
  const metadata = (transaction.metadata as Record<string, unknown>) || {};
  if (errorMessage) {
    metadata.errorMessage = errorMessage;
    metadata.failedAt = new Date().toISOString();
  }

  return await prisma.paymentTransaction.update({
    where: { id },
    data: {
      status: 'FAILED',
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get transaction summary statistics
 */
export async function getTransactionSummary(gatewayId?: string): Promise<{
  total: number;
  totalAmountCents: number;
  totalFeeCents: number;
  totalNetCents: number;
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
}> {
  const where = gatewayId ? { gatewayId } : {};

  const [transactions, aggregates] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      select: {
        status: true,
        method: true,
      },
    }),
    prisma.paymentTransaction.aggregate({
      where,
      _sum: {
        amountCents: true,
        feeCents: true,
        netCents: true,
      },
      _count: true,
    }),
  ]);

  // Count by status
  const byStatus: Record<string, number> = {};
  transactions.forEach((t) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  });

  // Count by method
  const byMethod: Record<string, number> = {};
  transactions.forEach((t) => {
    byMethod[t.method] = (byMethod[t.method] || 0) + 1;
  });

  return {
    total: aggregates._count,
    totalAmountCents: aggregates._sum.amountCents || 0,
    totalFeeCents: aggregates._sum.feeCents || 0,
    totalNetCents: aggregates._sum.netCents || 0,
    byStatus,
    byMethod,
  };
}
