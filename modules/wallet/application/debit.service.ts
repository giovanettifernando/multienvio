/**
 * Wallet Debit Service
 *
 * Processa débitos de carteira para pagamento de envios.
 * Implementa transação atômica com:
 * - Idempotência via referenceId
 * - Pessimistic locking (FOR UPDATE)
 * - Atualizações em cascata (shipments, labels, cart)
 *
 * Suporta injeção de dependências para testes unitários.
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import { logger as defaultLogger } from '@/platform/logging/logger';
import { ApiError } from '@/platform/api/errors';
import type { PrismaClient, Prisma } from '@prisma/client';

// =============================================================================
// Types & DTOs
// =============================================================================

export interface DebitInput {
  userId: string;
  shipmentId?: string;
  referenceId?: string;
  amount: number;
  reason?: string;
  trackingCode?: string;
  metadata?: Record<string, unknown>;
}

export interface DebitResult {
  ok: boolean;
  idempotent: boolean;
  balance: number;
  transactionId: string;
  shipmentIds?: string[];
  message?: string;
}

// Error codes
export const DebitErrorCodes = {
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  SHIPMENT_NOT_FOUND: 'SHIPMENT_NOT_FOUND',
} as const;

// Dependency injection interface
export interface DebitServiceDeps {
  prisma: PrismaClient | any;
  logger?: typeof defaultLogger;
}

// Default deps
const defaultDeps: DebitServiceDeps = {
  prisma: defaultPrisma,
  logger: defaultLogger,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calcula o valor em centavos a partir de reais.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Calcula o valor em reais a partir de centavos.
 */
export function toReais(cents: number): number {
  return cents / 100;
}

/**
 * Gera título da transação com base nos dados disponíveis.
 */
export function generateTransactionTitle(input: {
  trackingCode?: string;
  shipmentId?: string;
  reason?: string;
}): string {
  if (input.trackingCode) {
    return `Pagamento envio ${input.trackingCode}`;
  }
  if (input.shipmentId) {
    return `Pagamento envio ${input.shipmentId}`;
  }
  return `Pagamento - ${input.reason || 'compra'}`;
}

/**
 * Constrói o referenceId para idempotência.
 */
export function buildReferenceId(input: { customReferenceId?: string; shipmentId?: string }): string {
  return input.customReferenceId || `shipment:${input.shipmentId}`;
}

// =============================================================================
// Core Debit Logic
// =============================================================================

/**
 * Verifica se uma transação já existe (idempotência).
 * Retorna o resultado se já processada, null caso contrário.
 */
async function checkIdempotency(
  tx: any,
  referenceId: string,
  userId: string
): Promise<DebitResult | null> {
  const existingTransaction = await tx.walletTransaction.findUnique({
    where: { referenceId },
  });

  if (existingTransaction) {
    const wallet = await tx.wallet.findUnique({
      where: { userId },
    });

    return {
      ok: true,
      idempotent: true,
      balance: wallet ? toReais(wallet.availableCents) : 0,
      transactionId: existingTransaction.id,
      message: 'Pagamento já processado anteriormente',
    };
  }

  return null;
}

/**
 * Busca carteira com lock pessimista para evitar race conditions.
 */
async function getWalletWithLock(
  tx: any,
  userId: string
): Promise<{ id: string; availableCents: number }> {
  const wallets = await tx.$queryRaw<Array<{
    id: string;
    userId: string;
    availableCents: number;
    pendingCents: number;
  }>>`
    SELECT id, "userId", "availableCents", "pendingCents"
    FROM "wallets"
    WHERE "userId" = ${userId}
    FOR UPDATE
  `;

  const wallet = wallets[0];

  if (!wallet) {
    throw Object.assign(new Error('Carteira não encontrada'), {
      code: DebitErrorCodes.WALLET_NOT_FOUND,
    });
  }

  return wallet;
}

/**
 * Valida se há saldo suficiente.
 */
export function validateBalance(availableCents: number, amountCents: number): void {
  if (availableCents < amountCents) {
    throw Object.assign(new Error('Saldo insuficiente na carteira'), {
      code: DebitErrorCodes.INSUFFICIENT_FUNDS,
    });
  }
}

/**
 * Cria a transação de débito na carteira.
 */
async function createDebitTransaction(
  tx: any,
  params: {
    walletId: string;
    amountCents: number;
    title: string;
    referenceId: string;
    shipmentId?: string;
    trackingCode?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ id: string }> {
  return tx.walletTransaction.create({
    data: {
      walletId: params.walletId,
      type: 'PURCHASE',
      amountCents: params.amountCents,
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      title: params.title,
      referenceId: params.referenceId,
      meta: {
        ...(params.shipmentId && { shipmentId: params.shipmentId }),
        ...(params.trackingCode && { trackingCode: params.trackingCode }),
        reason: params.reason || 'shipment_payment',
        ...(params.metadata && params.metadata),
      },
    },
  });
}

/**
 * Cria entrada no ledger para auditoria.
 */
async function createLedgerEntry(
  tx: any,
  params: {
    walletId: string;
    amountCents: number;
    title: string;
    userId: string;
    transactionId: string;
    shipmentId?: string;
    trackingCode?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await tx.ledgerEntry.create({
    data: {
      type: 'CHARGE',
      amountCents: params.amountCents,
      accountType: 'WALLET',
      accountId: params.walletId,
      description: params.title,
      metadata: {
        ...(params.shipmentId && { shipmentId: params.shipmentId }),
        ...(params.trackingCode && { trackingCode: params.trackingCode }),
        userId: params.userId,
        walletTransactionId: params.transactionId,
        ...(params.metadata && params.metadata),
      },
    },
  });
}

/**
 * Atualiza shipments como pagos e emite labels.
 */
async function updateShipmentsAndLabels(
  tx: any,
  params: {
    userId: string;
    shipmentIds: string[];
    transactionId: string;
    amount: number;
  }
): Promise<void> {
  if (params.shipmentIds.length === 0) return;

  // Buscar shipments do usuário
  const shipmentsToUpdate = await tx.shipment.findMany({
    where: {
      id: { in: params.shipmentIds },
      senderId: params.userId,
    },
    select: {
      id: true,
      document: true,
    },
  });

  // Buscar labels existentes (otimização N+1)
  const shipmentIds = shipmentsToUpdate.map((s: { id: string }) => s.id);
  const existingLabels = await tx.label.findMany({
    where: { shipmentId: { in: shipmentIds } },
    select: { id: true, shipmentId: true },
  });

  // Atualizar shipments em batch
  await Promise.all(
    shipmentsToUpdate.map((ship: { id: string; document: unknown }) => {
      const currentDoc = (ship.document as Record<string, unknown>) || {};
      return tx.shipment.update({
        where: { id: ship.id },
        data: {
          paymentMethod: 'WALLET',
          document: {
            ...currentDoc,
            payment: {
              status: 'approved',
              method: 'wallet',
              confirmedAt: new Date().toISOString(),
              walletTransactionId: params.transactionId,
              amount: params.amount,
            },
          },
        },
      });
    })
  );

  // Atualizar labels como emitidas
  const labelIdsToUpdate = existingLabels.map((l: { id: string }) => l.id);
  if (labelIdsToUpdate.length > 0) {
    await tx.label.updateMany({
      where: { id: { in: labelIdsToUpdate } },
      data: { status: 'issued' },
    });
  }
}

/**
 * Finaliza carrinho após pagamento completo.
 */
async function finalizeCartIfComplete(
  tx: any,
  params: {
    userId: string;
    shipmentIds: string[];
  }
): Promise<void> {
  if (params.shipmentIds.length === 0) return;

  // Buscar carrinho LOCKED do usuário
  const cart = await tx.cart.findFirst({
    where: {
      userId: params.userId,
      status: 'LOCKED',
    },
  });

  if (!cart || !cart.meta) return;

  const cartMeta = cart.meta as { shipmentIds?: string[]; [key: string]: unknown };

  // Verificar se algum shipment pago pertence ao carrinho
  const hasMatchingShipments = params.shipmentIds.some(
    (id: string) => cartMeta.shipmentIds?.includes(id)
  );

  if (!hasMatchingShipments) return;

  // Verificar se todos os shipments do carrinho foram pagos
  const allCartShipments = await tx.shipment.findMany({
    where: {
      id: { in: cartMeta.shipmentIds || [] },
    },
  });

  const allPaid = allCartShipments.every(
    (s: { paymentMethod: string | null }) => s.paymentMethod !== null
  );

  if (allPaid) {
    // Remover itens e marcar como CHECKED_OUT
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await tx.cart.update({
      where: { id: cart.id },
      data: {
        status: 'CHECKED_OUT',
        updatedAt: new Date(),
      },
    });
  }
}

// =============================================================================
// Main Service Function
// =============================================================================

/**
 * Processa débito de carteira para pagamento de envios.
 *
 * Operação atômica que:
 * 1. Verifica idempotência via referenceId
 * 2. Obtém lock pessimista na carteira
 * 3. Valida saldo suficiente
 * 4. Debita carteira
 * 5. Cria transação e ledger entry
 * 6. Atualiza shipments e labels
 * 7. Finaliza carrinho se completo
 *
 * @throws ApiError com código específico em caso de erro
 */
export async function processDebit(
  input: DebitInput,
  deps: DebitServiceDeps = defaultDeps
): Promise<DebitResult> {
  const { prisma, logger } = deps;
  const { userId, shipmentId, amount, reason, trackingCode, metadata } = input;

  const amountCents = toCents(amount);
  const referenceId = buildReferenceId({
    customReferenceId: input.referenceId,
    shipmentId,
  });
  const title = generateTransactionTitle({ trackingCode, shipmentId, reason });

  // Verificar se shipment existe (se fornecido)
  if (shipmentId) {
    const existingShipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!existingShipment) {
      throw new ApiError({
        code: 'not_found',
        message: 'Envio não encontrado',
        status: 404,
      });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      // 1) Verificar idempotência
      const idempotentResult = await checkIdempotency(tx, referenceId, userId);
      if (idempotentResult) {
        return idempotentResult;
      }

      // 2) Buscar carteira COM LOCK
      const wallet = await getWalletWithLock(tx, userId);

      // 3) Verificar saldo
      validateBalance(wallet.availableCents, amountCents);

      // 4) Debitar carteira
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableCents: { decrement: amountCents },
        },
      });

      // 5) Criar transação na carteira
      const transaction = await createDebitTransaction(tx, {
        walletId: wallet.id,
        amountCents,
        title,
        referenceId,
        shipmentId,
        trackingCode,
        reason,
        metadata,
      });

      // 6) Criar entrada no ledger
      await createLedgerEntry(tx, {
        walletId: wallet.id,
        amountCents,
        title,
        userId,
        transactionId: transaction.id,
        shipmentId,
        trackingCode,
        metadata,
      });

      // 7) Determinar shipments a atualizar
      const shipmentIdsToUpdate = shipmentId
        ? [shipmentId]
        : metadata && Array.isArray(metadata.shipmentIds)
        ? (metadata.shipmentIds as string[])
        : [];

      // 8) Atualizar shipments e emitir labels
      await updateShipmentsAndLabels(tx, {
        userId,
        shipmentIds: shipmentIdsToUpdate,
        transactionId: transaction.id,
        amount,
      });

      // 9) Finalizar carrinho se todos pagos
      await finalizeCartIfComplete(tx, {
        userId,
        shipmentIds: shipmentIdsToUpdate,
      });

      logger?.info?.(
        {
          event: 'wallet_debit_success',
          userId,
          amountCents,
          transactionId: transaction.id,
          shipmentIds: shipmentIdsToUpdate,
        },
        'Wallet debit processed successfully'
      );

      return {
        ok: true,
        idempotent: false,
        balance: toReais(updatedWallet.availableCents),
        transactionId: transaction.id,
        shipmentIds: shipmentIdsToUpdate,
      };
    });

    return result;
  } catch (txError) {
    // Tratamento especial para P2002 (unique constraint violation - race condition)
    if (
      txError instanceof Error &&
      'code' in txError &&
      (txError as { code: string }).code === 'P2002'
    ) {
      const existingTransaction = await prisma.walletTransaction.findUnique({
        where: { referenceId },
      });

      if (existingTransaction) {
        const wallet = await prisma.wallet.findUnique({
          where: { userId },
        });

        return {
          ok: true,
          idempotent: true,
          balance: wallet ? toReais(wallet.availableCents) : 0,
          transactionId: existingTransaction.id,
          message: 'Pagamento já processado anteriormente',
        };
      }
    }

    logger?.error?.({ event: 'wallet_debit_error', err: txError }, 'Wallet debit failed');

    // Mapear erros conhecidos para ApiError
    if (txError instanceof Error && 'code' in txError) {
      const errorCode = (txError as { code: string }).code;

      if (errorCode === DebitErrorCodes.INSUFFICIENT_FUNDS) {
        throw new ApiError({
          code: 'insufficient_funds',
          message: 'Saldo insuficiente na carteira',
          status: 400,
        });
      }

      if (errorCode === DebitErrorCodes.WALLET_NOT_FOUND) {
        throw new ApiError({
          code: 'wallet_not_found',
          message: 'Carteira não encontrada',
          status: 404,
        });
      }
    }

    throw new ApiError({
      code: 'debit_error',
      message: 'Erro ao processar débito',
      status: 500,
    });
  }
}
