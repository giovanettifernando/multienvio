/**
 * Worker: Shipment Create (Fase 3)
 *
 * Processa a integração assíncrona com a transportadora após criação do envio.
 * O checkout cria o Shipment com status PROCESSING e enfileira este job.
 *
 * Fluxo:
 * 1. Carrega shipment + packages + dados do usuário do DB
 * 2. Chama integrateWithCarrier() para obter tracking code + etiqueta
 * 3. Sucesso → atualiza status para targetStatus (PICKUP_REQUESTED / AWAITING_DROP_OFF_AT_POINT)
 * 4. Falha (DLQ) → atualiza status para CREATION_FAILED
 * 5. Enfileira jobs filhos: label:generate + notification email
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../../platform/queue/connection';
import { getQueue, getQueueLimiter, QUEUE_NAMES, JOB_PRIORITY } from '../../platform/queue';
import { createJobLogger, withDuration, acquireLock, releaseLock } from '../../platform/queue/helpers';
import type {
  ShipmentCreateJobPayload,
  LabelGenerateJobPayload,
  NotificationStatusJobPayload,
} from '../../platform/queue/types';
import { integrateWithCarrier } from '../../modules/shipments/application/carrier-integration';
import { prisma } from '../../platform/db/db';

const LOCK_TTL_MS = 120_000; // 2 min lock por shipment

async function processShipmentCreate(job: Job<ShipmentCreateJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { shipmentId, userId, carrier, service, declaredValue, targetStatus, originAddress, externalServiceId } = job.data;

  log.info({ shipmentId, carrier }, 'Starting carrier integration for shipment');

  // Lock para evitar processamento duplicado
  const lockKey = `lock:shipment:create:${shipmentId}`;
  const acquired = await acquireLock(lockKey, LOCK_TTL_MS);

  if (!acquired) {
    log.warn({ shipmentId }, 'Skipping — lock already held');
    return;
  }

  try {
    // 1. Verificar se shipment ainda está em PROCESSING
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { packages: true },
    });

    if (!shipment) {
      log.error({ shipmentId }, 'Shipment not found');
      return;
    }

    if (shipment.status !== 'PROCESSING') {
      log.info({ shipmentId, status: shipment.status }, 'Shipment no longer in PROCESSING — skipping');
      return;
    }

    // 2. Carregar dados do remetente
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, razaoSocial: true, email: true, phone: true, cpf: true, cnpj: true },
    });

    if (!user) {
      log.error({ userId }, 'User not found');
      throw new Error(`User not found: ${userId}`);
    }

    const senderDocumento =
      (user.cnpj && user.cnpj.trim() !== '' ? user.cnpj : null) || user.cpf || '';

    const senderData = {
      nome: user.razaoSocial || user.name || 'Remetente',
      documento: senderDocumento.replace(/\D/g, ''),
      telefone: user.phone || undefined,
      email: user.email || undefined,
      cep: (originAddress.cep || shipment.originCep).replace(/\D/g, ''),
      logradouro: originAddress.logradouro || undefined,
      numero: originAddress.numero || undefined,
      complemento: originAddress.complemento || undefined,
      bairro: originAddress.bairro || undefined,
      cidade: originAddress.cidade || undefined,
      uf: originAddress.uf || undefined,
    };

    // Parse do endereço concatenado: "logradouro, numero, complemento"
    const destParts = (shipment.destinationAddress || '').split(',').map((s) => s.trim());

    const recipientData = {
      nome: shipment.recipientName || '',
      documento: shipment.recipientDocument || undefined,
      telefone: shipment.recipientPhone || undefined,
      email: shipment.recipientEmail || undefined,
      cep: shipment.destinationCep.replace(/\D/g, ''),
      logradouro: destParts[0] || '',
      numero: destParts[1] || 'S/N',
      complemento: destParts[2] || undefined,
      bairro: shipment.destinationNeighborhood || undefined,
      cidade: shipment.destinationCity || '',
      uf: shipment.destinationState || '',
    };

    // 3. Integrar com transportadora
    const { result: integrationResult, durationMs } = await withDuration(() =>
      integrateWithCarrier(prisma, {
        shipmentId,
        carrier,
        serviceName: service,
        serviceCode: externalServiceId,
        packages: shipment.packages,
        sender: senderData,
        recipient: recipientData,
        declaredValue,
        contentDescription: 'Mercadorias diversas',
      })
    );

    if (integrationResult.success) {
      // 4a. Sucesso → atualizar status
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: { status: targetStatus },
      });

      log.info({
        shipmentId,
        carrier,
        trackingCode: integrationResult.primaryTrackingCode,
        targetStatus,
        durationMs,
      }, 'Carrier integration succeeded');

      // 5. Enfileirar jobs filhos
      await enqueueChildJobs(shipmentId, carrier, shipment.recipientEmail, shipment.recipientName, userId);
    } else {
      // 4b. Falha — lançar erro para retry do BullMQ
      throw new Error(integrationResult.errorMessage || `Carrier integration failed for ${carrier}`);
    }
  } finally {
    await releaseLock(lockKey);
  }
}

/**
 * Enfileira jobs derivados após sucesso da integração com transportadora
 */
async function enqueueChildJobs(
  shipmentId: string,
  carrier: string,
  recipientEmail: string | null,
  recipientName: string | null,
  userId: string,
): Promise<void> {
  // Label generation (para carriers que precisam de etapa separada)
  const labelQueue = getQueue<LabelGenerateJobPayload>(QUEUE_NAMES.LABEL_GENERATE);
  const isLoggi = carrier.toLowerCase() === 'loggi';
  await labelQueue.add('generate', { shipmentId, carrier }, {
    priority: JOB_PRIORITY.HIGH,
    jobId: `label-${shipmentId}`,
    delay: isLoggi ? 60_000 : 0, // Loggi async-shipments: etiqueta disponível após processamento
  });

  // Email de tracking para o destinatário (via sendShipmentTrackingEmail direto)
  if (recipientEmail && recipientEmail.trim() !== '') {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        platformTrackingCode: true,
        publicTrackingId: true,
        destinationCity: true,
        destinationState: true,
        senderId: true,
      },
    });

    if (shipment) {
      const sender = await prisma.user.findUnique({
        where: { id: shipment.senderId },
        select: { name: true, razaoSocial: true },
      });
      const senderName = sender?.razaoSocial || sender?.name || 'Remetente';

      // Enviar via mailer diretamente (já tem retry no worker)
      try {
        const { sendShipmentTrackingEmail } = await import('../../platform/email/mailer');
        await sendShipmentTrackingEmail(
          recipientEmail,
          recipientName || 'Destinatário',
          shipment.platformTrackingCode,
          senderName,
          shipment.destinationCity || '',
          shipment.destinationState || '',
          shipment.publicTrackingId,
        );
      } catch {
        // Falha no email não deve bloquear o fluxo do shipment
        console.warn(`[SHIPMENT_CREATE] Failed to send tracking email for ${shipmentId}`);
      }
    }
  }

  // Notificação in-app para o remetente
  const notifQueue = getQueue<NotificationStatusJobPayload>(QUEUE_NAMES.NOTIFICATION_STATUS);
  await notifQueue.add('create', {
    userId,
    type: 'SHIPMENT_CREATED',
    title: 'Envio criado com sucesso',
    message: `Seu envio foi registrado na transportadora ${carrier}.`,
    metadata: { shipmentId, carrier },
  }, {
    priority: JOB_PRIORITY.LOW,
  });
}

/**
 * Cria e retorna o Worker de criação de shipment
 */
export function createShipmentCreateWorker(): Worker<ShipmentCreateJobPayload> {
  const limiter = getQueueLimiter(QUEUE_NAMES.SHIPMENT_CREATE);

  const worker = new Worker<ShipmentCreateJobPayload>(
    QUEUE_NAMES.SHIPMENT_CREATE,
    processShipmentCreate,
    {
      connection: queueConnection,
      concurrency: 3,
      limiter,
    }
  );

  worker.on('failed', async (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts?.attempts ?? 5;
    const isDLQ = attempt >= maxAttempts;

    console.error(JSON.stringify({
      level: 'error',
      msg: isDLQ ? 'Shipment creation moved to DLQ' : 'Shipment creation failed, will retry',
      queue: QUEUE_NAMES.SHIPMENT_CREATE,
      jobId: job?.id,
      shipmentId: job?.data?.shipmentId,
      carrier: job?.data?.carrier,
      attempt,
      maxAttempts,
      error: err.message,
      isDLQ,
      time: new Date().toISOString(),
    }));

    // Se DLQ, marcar shipment como CREATION_FAILED
    if (isDLQ && job?.data?.shipmentId) {
      try {
        await prisma.shipment.update({
          where: { id: job.data.shipmentId },
          data: { status: 'CREATION_FAILED' },
        });

        // Notificar admin
        const notifQueue = getQueue<NotificationStatusJobPayload>(QUEUE_NAMES.NOTIFICATION_STATUS);
        await notifQueue.add('create', {
          userId: job.data.userId,
          type: 'SHIPMENT_CREATION_FAILED',
          title: 'Falha na criação do envio',
          message: `Não foi possível integrar com ${job.data.carrier} após ${maxAttempts} tentativas. Erro: ${err.message}`,
          metadata: { shipmentId: job.data.shipmentId, carrier: job.data.carrier, error: err.message },
        }, { priority: JOB_PRIORITY.HIGH });
      } catch (updateErr) {
        console.error('[SHIPMENT_CREATE] Failed to update status to CREATION_FAILED:', updateErr);
      }
    }
  });

  return worker;
}
