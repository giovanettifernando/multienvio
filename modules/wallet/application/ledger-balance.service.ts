/**
 * Ledger-Based Wallet Balance Service
 *
 * ARQUITETURA: Saldo calculado do ledger (WalletTransaction) como fonte única de verdade.
 *
 * Benefícios:
 * - Impossível ter divergência entre saldo e transações
 * - Auditoria perfeita - todo centavo tem origem rastreável
 * - Padrão contábil (ledger = source of truth)
 *
 * Performance:
 * - Cache Redis com invalidação automática
 * - Fallback para cálculo direto se cache indisponível
 *
 * Tipos de transação e seu efeito no saldo:
 * - TOPUP: +amountCents (recarga)
 * - REFUND: +amountCents (reembolso)
 * - PURCHASE: -amountCents (compra)
 * - WITHDRAW: -amountCents (saque)
 * - ADJUSTMENT: ±amountCents (ajuste, pelo sinal)
 */

import { prisma as defaultPrisma } from '@/platform/db/db';
import { WalletTxType, WalletTxStatus } from '@prisma/client';
import { cacheGet, cacheSet, cacheDelete, CacheTTL } from '@/platform/cache/cache';
import { logger } from '@/platform/logging/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_PREFIX = 'wallet:balance:';
const CACHE_TTL = CacheTTL.SHORT; // 60 segundos - saldo é volátil

// Tipos que AUMENTAM o saldo
const CREDIT_TYPES: WalletTxType[] = [
  WalletTxType.TOPUP,
  WalletTxType.REFUND,
];

// Tipos que DIMINUEM o saldo
const DEBIT_TYPES: WalletTxType[] = [
  WalletTxType.PURCHASE,
  WalletTxType.WITHDRAW,
];

// ============================================================================
// TYPES
// ============================================================================

export interface LedgerBalance {
  availableCents: number;
  pendingCents: number;
  calculatedAt: Date;
  fromCache: boolean;
}

export interface LedgerBalanceServiceDeps {
  prisma: typeof defaultPrisma;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calcula o saldo disponível diretamente do ledger (WalletTransaction)
 *
 * Fórmula:
 * saldo = SUM(TOPUP + REFUND) - SUM(PURCHASE + WITHDRAW) + SUM(ADJUSTMENT)
 *
 * Apenas transações CONFIRMED são consideradas.
 */
export async function calculateBalanceFromLedger(
  walletId: string,
  deps: LedgerBalanceServiceDeps = { prisma: defaultPrisma }
): Promise<number> {
  const { prisma } = deps;

  // Query otimizada usando agregação SQL
  const result = await prisma.$queryRaw<[{ balance: bigint | null }]>`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN type IN ('TOPUP', 'REFUND') THEN "amountCents"
          WHEN type IN ('PURCHASE', 'WITHDRAW') THEN -"amountCents"
          WHEN type = 'ADJUSTMENT' THEN "amountCents"
          ELSE 0
        END
      ), 0) as balance
    FROM "wallet_transactions"
    WHERE "walletId" = ${walletId}
      AND status = 'CONFIRMED'
  `;

  const balance = result[0]?.balance;
  return balance ? Number(balance) : 0;
}

/**
 * Calcula o saldo pendente (transações não confirmadas)
 */
export async function calculatePendingFromLedger(
  walletId: string,
  deps: LedgerBalanceServiceDeps = { prisma: defaultPrisma }
): Promise<number> {
  const { prisma } = deps;

  const result = await prisma.$queryRaw<[{ pending: bigint | null }]>`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN type IN ('TOPUP', 'REFUND') THEN "amountCents"
          WHEN type IN ('PURCHASE', 'WITHDRAW') THEN -"amountCents"
          WHEN type = 'ADJUSTMENT' THEN "amountCents"
          ELSE 0
        END
      ), 0) as pending
    FROM "wallet_transactions"
    WHERE "walletId" = ${walletId}
      AND status = 'PENDING'
  `;

  const pending = result[0]?.pending;
  return pending ? Number(pending) : 0;
}

// ============================================================================
// CACHE LAYER
// ============================================================================

/**
 * Obtém saldo do cache ou calcula do ledger
 */
export async function getWalletBalance(
  walletId: string,
  deps: LedgerBalanceServiceDeps = { prisma: defaultPrisma }
): Promise<LedgerBalance> {
  const cacheKey = `${CACHE_PREFIX}${walletId}`;

  // Tentar cache primeiro
  const cached = await cacheGet<LedgerBalance>(cacheKey);
  if (cached) {
    logger.debug({ event: 'wallet_balance_cache_hit', walletId }, 'Balance from cache');
    return { ...cached, fromCache: true };
  }

  // Cache miss - calcular do ledger
  const [availableCents, pendingCents] = await Promise.all([
    calculateBalanceFromLedger(walletId, deps),
    calculatePendingFromLedger(walletId, deps),
  ]);

  const balance: LedgerBalance = {
    availableCents,
    pendingCents,
    calculatedAt: new Date(),
    fromCache: false,
  };

  // Salvar no cache
  await cacheSet(cacheKey, balance, CACHE_TTL);

  logger.debug({
    event: 'wallet_balance_calculated',
    walletId,
    availableCents,
    pendingCents,
  }, 'Balance calculated from ledger');

  return balance;
}

/**
 * Obtém saldo por userId (cria wallet se não existir)
 */
export async function getWalletBalanceByUserId(
  userId: string,
  deps: LedgerBalanceServiceDeps = { prisma: defaultPrisma }
): Promise<LedgerBalance & { walletId: string }> {
  const { prisma } = deps;

  // Buscar ou criar wallet
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!wallet) {
    // Criar wallet se não existir
    try {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          availableCents: 0, // Será ignorado - saldo vem do ledger
          pendingCents: 0,
        },
        select: { id: true },
      });
    } catch (error: unknown) {
      // Race condition - outro request criou
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        wallet = await prisma.wallet.findUnique({
          where: { userId },
          select: { id: true },
        });
      }
      if (!wallet) {
        throw new Error('Falha ao criar/buscar carteira');
      }
    }
  }

  const balance = await getWalletBalance(wallet.id, deps);
  return { ...balance, walletId: wallet.id };
}

// ============================================================================
// CACHE INVALIDATION
// ============================================================================

/**
 * Invalida cache do saldo de uma wallet
 * DEVE ser chamado após qualquer operação que altera o ledger
 */
export async function invalidateWalletBalanceCache(walletId: string): Promise<void> {
  const cacheKey = `${CACHE_PREFIX}${walletId}`;
  await cacheDelete(cacheKey);

  logger.debug({
    event: 'wallet_balance_cache_invalidated',
    walletId,
  }, 'Balance cache invalidated');
}

// ============================================================================
// RECONCILIATION (para verificar consistência com campo legado)
// ============================================================================

export interface ReconciliationResult {
  walletId: string;
  userId: string;
  storedBalance: number;
  calculatedBalance: number;
  difference: number;
  isConsistent: boolean;
}

/**
 * Compara saldo armazenado (campo legado) com saldo calculado do ledger
 * Útil para verificar consistência durante migração
 */
export async function reconcileWalletBalance(
  walletId: string,
  deps: LedgerBalanceServiceDeps = { prisma: defaultPrisma }
): Promise<ReconciliationResult> {
  const { prisma } = deps;

  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { id: true, userId: true, availableCents: true },
  });

  if (!wallet) {
    throw new Error(`Wallet não encontrada: ${walletId}`);
  }

  const calculatedBalance = await calculateBalanceFromLedger(walletId, deps);
  const difference = wallet.availableCents - calculatedBalance;

  return {
    walletId: wallet.id,
    userId: wallet.userId,
    storedBalance: wallet.availableCents,
    calculatedBalance,
    difference,
    isConsistent: difference === 0,
  };
}

/**
 * Reconcilia todas as wallets e retorna divergências
 */
export async function reconcileAllWallets(
  deps: LedgerBalanceServiceDeps = { prisma: defaultPrisma }
): Promise<ReconciliationResult[]> {
  const { prisma } = deps;

  const wallets = await prisma.wallet.findMany({
    select: { id: true },
  });

  const results: ReconciliationResult[] = [];

  for (const wallet of wallets) {
    const result = await reconcileWalletBalance(wallet.id, deps);
    if (!result.isConsistent) {
      results.push(result);
    }
  }

  if (results.length > 0) {
    logger.warn({
      event: 'wallet_reconciliation_divergences',
      count: results.length,
      divergences: results,
    }, 'Found wallet balance divergences');
  } else {
    logger.info({
      event: 'wallet_reconciliation_success',
      walletsChecked: wallets.length,
    }, 'All wallets are consistent');
  }

  return results;
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Sincroniza o campo availableCents com o saldo calculado do ledger
 * Usado para corrigir divergências ou durante migração
 */
export async function syncWalletBalanceFromLedger(
  walletId: string,
  deps: LedgerBalanceServiceDeps = { prisma: defaultPrisma }
): Promise<{ oldBalance: number; newBalance: number }> {
  const { prisma } = deps;

  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { availableCents: true, pendingCents: true },
  });

  if (!wallet) {
    throw new Error(`Wallet não encontrada: ${walletId}`);
  }

  const [calculatedAvailable, calculatedPending] = await Promise.all([
    calculateBalanceFromLedger(walletId, deps),
    calculatePendingFromLedger(walletId, deps),
  ]);

  await prisma.wallet.update({
    where: { id: walletId },
    data: {
      availableCents: calculatedAvailable,
      pendingCents: calculatedPending,
    },
  });

  // Invalidar cache
  await invalidateWalletBalanceCache(walletId);

  logger.info({
    event: 'wallet_balance_synced',
    walletId,
    oldAvailable: wallet.availableCents,
    newAvailable: calculatedAvailable,
    oldPending: wallet.pendingCents,
    newPending: calculatedPending,
  }, 'Wallet balance synced from ledger');

  return {
    oldBalance: wallet.availableCents,
    newBalance: calculatedAvailable,
  };
}
