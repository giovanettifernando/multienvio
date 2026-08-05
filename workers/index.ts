/**
 * Worker Process Entrypoint
 *
 * Processo Node.js separado do Next.js que registra e executa
 * todos os workers BullMQ com graceful shutdown.
 *
 * Uso:
 *   npm run workers          # produção
 *   npm run workers:dev      # desenvolvimento com hot-reload
 *
 * Registra:
 * - Tracking scheduler (repeatable: 15 min)
 * - Tracking workers (Correios, J&T, Loggi)
 * - PIX monitor (repeatable: 2 min)
 * - Recipient payment expiration (repeatable: 1 hora)
 * - Email sender (assíncrono com retry)
 * - Shipment create (integração assíncrona com carrier)
 * - Label generate (geração de etiqueta)
 * - Notification status (notificações in-app)
 * - Reconciliation (reconciliação financeira diária, repeatable: 03:00 UTC)
 * - PDF Generate (geração assíncrona de PDFs: etiquetas, extratos, batch)
 * - FIPE Sync (sincronização de marcas/modelos FIPE via fila)
 * - Correios Agencies Sync (sincronização de agências por UF via fila)
 * - Asaas Webhook (processamento assíncrono de webhooks de cobrança, acionado por evento de fila)
 */

// Carregar .env (Next.js faz isso automaticamente, tsx não).
//
// PRECISA ser `import 'dotenv/config'` e ser o PRIMEIRO import do arquivo: a
// forma anterior (`import { config }` seguido de `config()` no corpo) carregava
// o .env tarde demais, porque o corpo do módulo só executa depois que TODOS os
// imports foram resolvidos — e os módulos importados abaixo leem process.env no
// escopo deles. O sintoma era o processo subir e acusar DATABASE_URL, JWT_SECRET
// e companhia como ausentes, mesmo estando no .env.
import 'dotenv/config';

import { type Worker } from 'bullmq';
import { closeAllQueues, closeLockRedis } from '../platform/queue';

// Tracking
import { createCorreiosTrackingWorker } from './tracking/correios.worker';
import { createJTTrackingWorker } from './tracking/jt.worker';
import { createLoggiTrackingWorker } from './tracking/loggi.worker';
import { createTrackingSchedulerWorker, registerTrackingSchedulerRepeatable } from './tracking/scheduler.worker';

// Payments
import { createPixMonitorWorker, registerPixMonitorRepeatable } from './payment/pix-monitor.worker';
import { createRecipientExpirationWorker, registerRecipientExpirationRepeatable } from './payment/recipient-expiration.worker';

// Email
import { createEmailWorker } from './email/email.worker';

// Shipment (Fase 3)
import { createShipmentCreateWorker } from './shipment/create.worker';
import { createLabelGenerateWorker } from './shipment/label.worker';

// Notifications (Fase 3)
import { createNotificationStatusWorker } from './notification/status.worker';

// Reconciliation (Fase 3)
import { createReconciliationWorker, registerReconciliationRepeatable } from './reconciliation/reconciliation.worker';

// PDF Generation
import { createPdfGenerateWorker, registerPdfCleanupRepeatable } from './pdf/generate.worker';

// Admin Sync
import { createFipeSyncWorker } from './admin/fipe-sync.worker';
import { createCorreiosAgenciesSyncWorker } from './admin/correios-agencies-sync.worker';

// Webhook (Asaas)
import { createAsaasWebhookWorker } from './webhook/asaas.worker';

// ============================================================================
// Estado global
// ============================================================================

const workers: Worker[] = [];
let isShuttingDown = false;

// ============================================================================
// Startup
// ============================================================================

async function start(): Promise<void> {
  console.log('='.repeat(60));
  console.log('[WORKERS] Starting Envio Legal worker process...');
  console.log('[WORKERS] PID:', process.pid);
  console.log('[WORKERS] Node:', process.version);
  console.log('[WORKERS] ENV:', process.env.NODE_ENV || 'development');
  console.log('='.repeat(60));

  // 1. Registrar jobs repeatables (schedulers/crons)
  console.log('[WORKERS] Registering repeatable jobs...');
  await registerTrackingSchedulerRepeatable();
  await registerPixMonitorRepeatable();
  await registerRecipientExpirationRepeatable();
  await registerReconciliationRepeatable();
  await registerPdfCleanupRepeatable();

  // 2. Criar workers
  console.log('[WORKERS] Creating workers...');

  workers.push(
    createTrackingSchedulerWorker(),
    createCorreiosTrackingWorker(),
    createJTTrackingWorker(),
    createLoggiTrackingWorker(),
    createPixMonitorWorker(),
    createRecipientExpirationWorker(),
    createEmailWorker(),
    createShipmentCreateWorker(),
    createLabelGenerateWorker(),
    createNotificationStatusWorker(),
    createReconciliationWorker(),
    createPdfGenerateWorker(),
    createFipeSyncWorker(),
    createCorreiosAgenciesSyncWorker(),
    createAsaasWebhookWorker(),
  );

  console.log(`[WORKERS] ${workers.length} workers started:`);
  for (const w of workers) {
    console.log(`  - ${w.name} (concurrency: ${w.opts.concurrency})`);
  }

  console.log('[WORKERS] Ready and processing jobs');
  console.log('='.repeat(60));
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[WORKERS] Received ${signal} — shutting down gracefully...`);

  // Parar de aceitar novos jobs e esperar os em andamento finalizar
  const closePromises = workers.map(async (w) => {
    try {
      console.log(`[WORKERS] Closing worker: ${w.name}`);
      await w.close();
    } catch (err) {
      console.error(`[WORKERS] Error closing worker ${w.name}:`, (err as Error).message);
    }
  });

  // Timeout de 30s para shutdown
  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn('[WORKERS] Shutdown timeout (30s) — forcing exit');
      resolve();
    }, 30_000);
  });

  await Promise.race([
    Promise.all(closePromises),
    timeout,
  ]);

  // Fechar filas e Redis
  await closeAllQueues();
  await closeLockRedis();

  console.log('[WORKERS] All workers closed. Bye!');
  process.exit(0);
}

// Registrar signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handler para erros não tratados
process.on('unhandledRejection', (reason) => {
  console.error('[WORKERS] Unhandled rejection:', reason);
  // Não matar o processo — os workers do BullMQ têm retry
});

process.on('uncaughtException', (error) => {
  console.error('[WORKERS] Uncaught exception:', error);
  // Shutdown graceful após exceção não capturada
  shutdown('uncaughtException').catch(() => process.exit(1));
});

// ============================================================================
// Boot
// ============================================================================

start().catch((err) => {
  console.error('[WORKERS] Failed to start:', err);
  process.exit(1);
});
