/**
 * Worker: Financial Reconciliation (Fase 3)
 *
 * Job repeatable diário que verifica a consistência entre:
 * - Wallet.availableCents vs saldo calculado do ledger (WalletTransaction)
 * - PaymentTransaction totais vs LedgerEntry totais
 *
 * Gera relatório de divergências e loga para o admin.
 *
 * Período: diário às 03:00 (horário de menor uso)
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueue, getQueueLimiter, QUEUE_NAMES } from '../../platform/queue';
import { createJobLogger, withDuration } from '../../platform/queue/helpers';
import type { ReconciliationJobPayload, NotificationStatusJobPayload } from '../../platform/queue/types';
import { JOB_PRIORITY } from '../../platform/queue/types';
import { reconcileAllWallets, syncWalletBalanceFromLedger } from '../../modules/wallet/application/ledger-balance.service';
import { prisma } from '../../platform/db/db';

async function processReconciliation(job: Job<ReconciliationJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { trigger } = job.data;

  log.info({ trigger }, 'Starting financial reconciliation');

  // 1. Reconciliar wallets (saldo armazenado vs calculado do ledger)
  const { result: walletDivergences, durationMs: walletDuration } = await withDuration(() =>
    reconcileAllWallets()
  );

  log.info({
    walletDivergences: walletDivergences.length,
    walletDurationMs: walletDuration,
  }, 'Wallet reconciliation completed');

  // Auto-corrigir divergências de wallet
  for (const divergence of walletDivergences) {
    log.warn({
      walletId: divergence.walletId,
      userId: divergence.userId,
      storedBalance: divergence.storedBalance,
      calculatedBalance: divergence.calculatedBalance,
      difference: divergence.difference,
    }, 'Wallet balance divergence found — auto-syncing');

    await syncWalletBalanceFromLedger(divergence.walletId);
  }

  // 2. Reconciliar PaymentTransaction vs LedgerEntry
  const { result: paymentDivergence, durationMs: paymentDuration } = await withDuration(() =>
    reconcilePaymentVsLedger()
  );

  log.info({
    paymentDivergence,
    paymentDurationMs: paymentDuration,
  }, 'Payment vs Ledger reconciliation completed');

  // 3. Resumo final
  const totalDivergences = walletDivergences.length + (paymentDivergence.isConsistent ? 0 : 1);

  if (totalDivergences > 0) {
    log.warn({
      totalDivergences,
      walletDivergences: walletDivergences.length,
      paymentConsistent: paymentDivergence.isConsistent,
    }, 'Reconciliation found divergences');

    // Notificar admins sobre divergências
    // Buscar um staff ativo para notificar
    const admin = await prisma.staffUser.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    if (admin) {
      const notifQueue = getQueue<NotificationStatusJobPayload>(QUEUE_NAMES.NOTIFICATION_STATUS);
      await notifQueue.add('create', {
        userId: admin.id,
        type: 'RECONCILIATION_DIVERGENCE',
        title: 'Divergências na reconciliação financeira',
        message: `Encontradas ${totalDivergences} divergência(s). Wallets: ${walletDivergences.length}${walletDivergences.length > 0 ? ' (auto-corrigidas)' : ''}. Payments: ${paymentDivergence.isConsistent ? 'OK' : 'divergente'}.`,
        metadata: {
          walletDivergences: walletDivergences.length,
          paymentDivergence,
          trigger,
        },
      }, { priority: JOB_PRIORITY.LOW });
    }
  } else {
    log.info({ trigger }, 'Reconciliation completed — no divergences found');
  }
}

/**
 * Compara totais de PaymentTransaction PAID vs LedgerEntry CHARGE
 */
async function reconcilePaymentVsLedger(): Promise<{
  isConsistent: boolean;
  totalPayments: number;
  totalLedgerCharges: number;
  difference: number;
}> {
  // Total de PaymentTransactions com status PAID
  const paymentResult = await prisma.$queryRaw<[{ total: bigint | null }]>`
    SELECT COALESCE(SUM("amountCents"), 0) as total
    FROM "payment_transactions"
    WHERE status = 'PAID'
      AND method = 'WALLET'
  `;

  // Total de LedgerEntries tipo CHARGE
  const ledgerResult = await prisma.$queryRaw<[{ total: bigint | null }]>`
    SELECT COALESCE(SUM("amountCents"), 0) as total
    FROM "ledger_entries"
    WHERE type = 'CHARGE'
  `;

  const totalPayments = Number(paymentResult[0]?.total ?? 0);
  const totalLedgerCharges = Number(ledgerResult[0]?.total ?? 0);
  const difference = totalPayments - totalLedgerCharges;

  return {
    isConsistent: difference === 0,
    totalPayments,
    totalLedgerCharges,
    difference,
  };
}

/**
 * Registra job repeatable de reconciliação (diário às 03:00 UTC)
 */
export async function registerReconciliationRepeatable(): Promise<void> {
  const queue = getQueue<ReconciliationJobPayload>(QUEUE_NAMES.RECONCILIATION);

  await queue.upsertJobScheduler(
    'reconciliation-daily',
    { pattern: '0 3 * * *' }, // 03:00 UTC diário
    {
      name: 'reconcile',
      data: { trigger: 'scheduled' },
      opts: { priority: JOB_PRIORITY.LOW },
    }
  );

  console.log('[RECONCILIATION] Registered daily repeatable job (03:00 UTC)');
}

/**
 * Cria e retorna o Worker de reconciliação
 */
export function createReconciliationWorker(): Worker<ReconciliationJobPayload> {
  const limiter = getQueueLimiter(QUEUE_NAMES.RECONCILIATION);

  const worker = new Worker<ReconciliationJobPayload>(
    QUEUE_NAMES.RECONCILIATION,
    processReconciliation,
    {
      connection: queueConnection,
      concurrency: 1, // Apenas 1 reconciliação por vez
      limiter,
    }
  );

  worker.on('failed', (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 2;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'Reconciliation moved to DLQ' : 'Reconciliation failed, will retry',
      queue: QUEUE_NAMES.RECONCILIATION,
      jobId: job?.id,
      trigger: job?.data?.trigger,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));
  });

  return worker;
}
