/**
 * Serviço de monitoramento de pagamentos PIX pendentes — Pagar.me
 *
 * Responsável por:
 * - Monitorar PIX pendentes e verificar status na Pagar.me
 * - Marcar PIX expirados como cancelados
 * - Registrar PIX não realizados na carteira do usuário
 *
 * Chamado periodicamente via BullMQ worker
 */

import { prisma } from '@/platform/db/db';
import { WalletTxType, WalletTxStatus } from '@prisma/client';
import { getOrder, processOrderData } from './orders';
import { updatePaymentFromPagarme } from './payments';
import { getOrCreateWallet, centsToReais } from '@/modules/wallet/application/wallet.service';

// PIX expira em 30 minutos por padrão na Pagar.me
const PIX_EXPIRATION_MINUTES = 30;

// Máximo de pagamentos para processar por execução
const MAX_BATCH_SIZE = 50;

export interface PixMonitorResult {
  processed: number;
  approved: number;
  expired: number;
  pending: number;
  errors: number;
  details: Array<{
    transactionId: string;
    externalId: string | null;
    status: string;
    action: 'approved' | 'expired' | 'still_pending' | 'error';
    error?: string;
  }>;
}

/**
 * Busca pagamentos PIX pendentes que precisam ser verificados
 */
export async function getPendingPixPayments(): Promise<
  Array<{
    id: string;
    externalId: string | null;
    userId: string | null;
    amountCents: number;
    createdAt: Date;
    metadata: Record<string, unknown> | null;
  }>
> {
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'pagarme', status: 'ACTIVE' },
  });

  if (!gateway) {
    console.warn('[PIX_MONITOR] Gateway Pagar.me não encontrado');
    return [];
  }

  // Buscar PIX pendentes criados há mais de 1 minuto (dar tempo para o cliente pagar)
  // e há menos de 24 horas (evitar processar muito antigos)
  const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pendingPayments = await prisma.paymentTransaction.findMany({
    where: {
      gatewayId: gateway.id,
      method: 'PIX',
      status: 'PENDING',
      createdAt: {
        gte: twentyFourHoursAgo,
        lte: oneMinuteAgo,
      },
      externalId: { not: null }, // Apenas os que foram criados na Pagar.me
    },
    take: MAX_BATCH_SIZE,
    orderBy: { createdAt: 'asc' }, // Processar os mais antigos primeiro
    select: {
      id: true,
      externalId: true,
      userId: true,
      amountCents: true,
      createdAt: true,
      metadata: true,
    },
  });

  return pendingPayments.map((p) => ({
    ...p,
    metadata: p.metadata as Record<string, unknown> | null,
  }));
}

/**
 * Verifica se um PIX está expirado baseado no tempo de criação
 */
export function isPixExpired(createdAt: Date): boolean {
  const expirationTime = new Date(createdAt.getTime() + PIX_EXPIRATION_MINUTES * 60 * 1000);
  return new Date() > expirationTime;
}

/**
 * Registra um PIX não realizado na carteira do usuário
 * Cria uma entrada informativa (valor 0) para histórico
 */
export async function recordFailedPixInWallet(
  userId: string,
  amountCents: number,
  paymentTransactionId: string,
  reason: 'expired' | 'rejected' | 'cancelled'
): Promise<void> {
  const wallet = await getOrCreateWallet(userId);

  // Verificar se já existe registro para este pagamento
  const existingRecord = await prisma.walletTransaction.findFirst({
    where: {
      meta: {
        path: ['paymentTransactionId'],
        equals: paymentTransactionId,
      },
      type: WalletTxType.TOPUP,
    },
  });

  if (existingRecord) {
    console.log('[PIX_MONITOR] Registro já existe para pagamento:', paymentTransactionId);
    return;
  }

  const reasonMessages: Record<string, string> = {
    expired: 'PIX expirado - pagamento não realizado',
    rejected: 'PIX rejeitado pelo banco',
    cancelled: 'PIX cancelado',
  };

  const title = reasonMessages[reason] || 'Pagamento PIX não realizado';

  // Criar registro informativo (valor 0, apenas para histórico)
  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: WalletTxType.TOPUP,
      status: WalletTxStatus.FAILED,
      amountCents: 0, // Não houve crédito
      title: `${title} - R$ ${centsToReais(amountCents).toFixed(2)}`,
      referenceId: paymentTransactionId,
      meta: {
        paymentTransactionId,
        originalAmountCents: amountCents,
        reason,
        source: 'pix_monitor',
        recordedAt: new Date().toISOString(),
      },
    },
  });

  console.log('[PIX_MONITOR] Registro de PIX não realizado criado:', {
    userId,
    paymentTransactionId,
    reason,
    amountCents,
  });
}

/**
 * Processa um pagamento PIX pendente
 * - Verifica status na Pagar.me
 * - Se aprovado, aplica efeitos (crédito na carteira, etc)
 * - Se expirado/cancelado, marca e registra na carteira
 */
export async function processPixPayment(payment: {
  id: string;
  externalId: string | null;
  userId: string | null;
  amountCents: number;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}): Promise<{
  action: 'approved' | 'expired' | 'still_pending' | 'error';
  error?: string;
}> {
  try {
    if (!payment.externalId) {
      return { action: 'error', error: 'Sem externalId' };
    }

    // Verificar status na Pagar.me
    const order = await getOrder(payment.externalId);
    const processed = processOrderData(order);
    const newStatus = processed.status;

    console.log('[PIX_MONITOR] Status do pagamento na Pagar.me:', {
      transactionId: payment.id,
      externalId: payment.externalId,
      pagarmeStatus: order.status,
      internalStatus: newStatus,
    });

    if (newStatus === 'PAID') {
      // Pagamento aprovado! Atualizar e aplicar efeitos
      await updatePaymentFromPagarme(payment.externalId);
      return { action: 'approved' };
    }

    if (newStatus === 'CANCELED' || newStatus === 'FAILED') {
      // Pagamento cancelado/rejeitado pela Pagar.me
      await prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
        },
      });

      // Registrar na carteira se houver userId
      if (payment.userId) {
        await recordFailedPixInWallet(
          payment.userId,
          payment.amountCents,
          payment.id,
          newStatus === 'CANCELED' ? 'cancelled' : 'rejected'
        );
      }

      return { action: 'expired' };
    }

    // Ainda pendente na Pagar.me - verificar se expirou pelo tempo
    if (isPixExpired(payment.createdAt)) {
      // PIX expirou pelo tempo, marcar como cancelado
      await prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: 'CANCELED',
          metadata: {
            ...(payment.metadata || {}),
            expiredAt: new Date().toISOString(),
            expiredReason: 'timeout',
          },
        },
      });

      // Registrar na carteira se houver userId
      if (payment.userId) {
        await recordFailedPixInWallet(
          payment.userId,
          payment.amountCents,
          payment.id,
          'expired'
        );
      }

      return { action: 'expired' };
    }

    // Ainda dentro do prazo, continua pendente
    return { action: 'still_pending' };
  } catch (error) {
    console.error('[PIX_MONITOR] Erro ao processar pagamento:', payment.id, error);
    return {
      action: 'error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Executa o monitoramento de todos os PIX pendentes na Pagar.me
 * Chamado pelo worker BullMQ
 */
export async function monitorPendingPixPayments(): Promise<PixMonitorResult> {
  console.log('[PIX_MONITOR] Iniciando monitoramento de PIX pendentes (Pagar.me)...');

  const result: PixMonitorResult = {
    processed: 0,
    approved: 0,
    expired: 0,
    pending: 0,
    errors: 0,
    details: [],
  };

  try {
    const pendingPayments = await getPendingPixPayments();
    console.log(`[PIX_MONITOR] Encontrados ${pendingPayments.length} PIX pendentes`);

    for (const payment of pendingPayments) {
      result.processed++;

      const { action, error } = await processPixPayment(payment);

      result.details.push({
        transactionId: payment.id,
        externalId: payment.externalId,
        status: action,
        action,
        error,
      });

      switch (action) {
        case 'approved':
          result.approved++;
          break;
        case 'expired':
          result.expired++;
          break;
        case 'still_pending':
          result.pending++;
          break;
        case 'error':
          result.errors++;
          break;
      }
    }

    console.log('[PIX_MONITOR] Monitoramento concluído:', {
      processed: result.processed,
      approved: result.approved,
      expired: result.expired,
      pending: result.pending,
      errors: result.errors,
    });

    return result;
  } catch (error) {
    console.error('[PIX_MONITOR] Erro crítico no monitoramento:', error);
    throw error;
  }
}

/**
 * Limpa registros de PIX muito antigos (> 7 dias)
 * Marca como CANCELED para não serem reprocessados
 * Filtra apenas transações Pagar.me para evitar afetar outros gateways
 */
export async function cleanupOldPendingPix(): Promise<number> {
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'pagarme', status: 'ACTIVE' },
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.paymentTransaction.updateMany({
    where: {
      ...(gateway ? { gatewayId: gateway.id } : {}),
      method: 'PIX',
      status: 'PENDING',
      createdAt: { lt: sevenDaysAgo },
    },
    data: {
      status: 'CANCELED',
    },
  });

  if (result.count > 0) {
    console.log(`[PIX_MONITOR] Limpeza: ${result.count} PIX antigos marcados como CANCELED`);
  }

  return result.count;
}
