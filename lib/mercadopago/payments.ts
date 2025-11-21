/**
 * Serviço de pagamentos via Mercado Pago
 *
 * Responsável por:
 * - Criar pagamentos e registrar no banco (PaymentTransaction)
 * - Atualizar status de pagamentos
 * - Aplicar efeitos de domínio (crédito de carteira, etc)
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import {
  createPayment as createMPPayment,
  getPaymentById as getMPPaymentById,
  processPaymentData,
} from './client';
import type { CreatePaymentInput, MercadoPagoPaymentResponse } from './types';
import type { PaymentTransaction } from '@prisma/client';

/**
 * Resultado da criação de pagamento
 */
export interface CreatePaymentResult {
  transaction: PaymentTransaction;
  paymentData: MercadoPagoPaymentResponse;
}

/**
 * Cria um pagamento no Mercado Pago e registra no banco
 *
 * Fluxo:
 * 1. Busca gateway ativo do Mercado Pago
 * 2. Cria registro PaymentTransaction com status PENDING
 * 3. Chama API do Mercado Pago
 * 4. Atualiza PaymentTransaction com dados do MP
 *
 * @param input Dados do pagamento
 * @returns Transaction criada + dados do MP
 */
export async function createPaymentWithTracking(
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  // 1. Buscar gateway do Mercado Pago
  const gateway = await prisma.paymentGateway.findFirst({
    where: {
      slug: 'mercadopago',
      status: 'ACTIVE',
    },
  });

  if (!gateway) {
    throw new Error('Gateway Mercado Pago não configurado ou inativo');
  }

  // 2. Gerar referenceId único
  const referenceId = `mp_${nanoid(16)}`;

  // 3. Criar registro PaymentTransaction inicial
  const transaction = await prisma.paymentTransaction.create({
    data: {
      gatewayId: gateway.id,
      referenceId,
      userId: input.metadata?.userId as string | undefined,
      method: input.paymentMethodId === 'pix' ? 'PIX' : 'CREDIT_CARD', // Simplificado por enquanto
      status: 'PENDING',
      amountCents: Math.round(input.transactionAmount * 100),
      feeCents: 0,
      netCents: Math.round(input.transactionAmount * 100),
      metadata: (input.metadata || {}) as Prisma.InputJsonValue,
    },
  });

  try {
    // 4. Criar pagamento no Mercado Pago
    const mpPayment = await createMPPayment(input);

    // 5. Processar dados do MP
    const processedData = processPaymentData(mpPayment);

    // 6. Atualizar transaction com dados do MP
    const updatedTransaction = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        externalId: processedData.externalId,
        status: processedData.status,
        amountCents: processedData.amountCents,
        feeCents: processedData.feeCents,
        netCents: processedData.netCents,
        method: processedData.method,
        cardBrand: processedData.cardBrand,
        cardLast4: processedData.cardLast4,
        pixQrCode: processedData.pixQrCode,
        pixKey: processedData.pixKey,
        boletoUrl: processedData.boletoUrl,
        boletoBarcode: processedData.boletoBarcode,
        authorizedAt: processedData.authorizedAt,
        paidAt: processedData.paidAt,
      },
    });

    // 7. Se já foi pago, aplicar efeitos de domínio
    if (processedData.status === 'PAID') {
      await applyPaymentEffects(updatedTransaction);
    }

    return {
      transaction: updatedTransaction,
      paymentData: mpPayment,
    };
  } catch (error) {
    // Marcar transação como falhada
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'FAILED',
      },
    });

    throw error;
  }
}

/**
 * Atualiza status de um pagamento baseado no ID do MP
 *
 * Usado principalmente pelos webhooks
 *
 * @param externalId ID do pagamento no Mercado Pago
 * @returns Transaction atualizada
 */
export async function updatePaymentFromMercadoPago(
  externalId: string
): Promise<PaymentTransaction> {
  // 1. Buscar pagamento no MP
  const mpPayment = await getMPPaymentById(externalId);
  const processedData = processPaymentData(mpPayment);

  // 2. Buscar transaction pelo externalId
  let transaction = await prisma.paymentTransaction.findFirst({
    where: { externalId },
  });

  if (!transaction) {
    // Se não existe, criar nova (caso webhook chegue antes da criação)
    const gateway = await prisma.paymentGateway.findFirst({
      where: { slug: 'mercadopago', status: 'ACTIVE' },
    });

    if (!gateway) {
      throw new Error('Gateway Mercado Pago não encontrado');
    }

    transaction = await prisma.paymentTransaction.create({
      data: {
        gatewayId: gateway.id,
        externalId,
        referenceId: `mp_webhook_${nanoid(16)}`,
        method: processedData.method,
        status: processedData.status,
        amountCents: processedData.amountCents,
        feeCents: processedData.feeCents,
        netCents: processedData.netCents,
        cardBrand: processedData.cardBrand,
        cardLast4: processedData.cardLast4,
        pixQrCode: processedData.pixQrCode,
        pixKey: processedData.pixKey,
        boletoUrl: processedData.boletoUrl,
        boletoBarcode: processedData.boletoBarcode,
        authorizedAt: processedData.authorizedAt,
        paidAt: processedData.paidAt,
      },
    });
  } else {
    // Atualizar transaction existente
    transaction = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: processedData.status,
        feeCents: processedData.feeCents,
        netCents: processedData.netCents,
        cardBrand: processedData.cardBrand,
        cardLast4: processedData.cardLast4,
        pixQrCode: processedData.pixQrCode,
        pixKey: processedData.pixKey,
        boletoUrl: processedData.boletoUrl,
        boletoBarcode: processedData.boletoBarcode,
        authorizedAt: processedData.authorizedAt,
        paidAt: processedData.paidAt,
        updatedAt: new Date(),
      },
    });
  }

  // 3. Aplicar efeitos de domínio se necessário
  if (processedData.status === 'PAID' && transaction.status !== 'PAID') {
    await applyPaymentEffects(transaction);
  }

  return transaction;
}

/**
 * Aplica efeitos de domínio após pagamento confirmado
 *
 * Efeitos possíveis:
 * - wallet_topup: Creditar saldo na carteira
 * - checkout_payment: Marcar envios como pagos
 */
async function applyPaymentEffects(transaction: PaymentTransaction): Promise<void> {
  const metadata = transaction.metadata as Record<string, unknown> | null;

  if (!metadata || !metadata.type) {
    console.warn('[MERCADO_PAGO] Transaction sem metadata ou tipo:', transaction.id);
    return;
  }

  try {
    switch (metadata.type) {
      case 'wallet_topup':
        await applyWalletTopup(transaction);
        break;

      case 'checkout_payment':
        await applyCheckoutPayment(transaction);
        break;

      default:
        console.warn('[MERCADO_PAGO] Tipo de pagamento desconhecido:', metadata.type);
    }
  } catch (error) {
    console.error('[MERCADO_PAGO] Erro ao aplicar efeitos de pagamento:', error);
    // Não lançar erro para não bloquear o webhook
  }
}

/**
 * Credita saldo na carteira do usuário
 */
async function applyWalletTopup(transaction: PaymentTransaction): Promise<void> {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  const userId = transaction.userId || (metadata?.userId as string | undefined);

  if (!userId) {
    console.error('[MERCADO_PAGO] Wallet topup sem userId:', transaction.id);
    return;
  }

  // Verificar se já foi aplicado (idempotência)
  const existingWalletTx = await prisma.walletTransaction.findUnique({
    where: { referenceId: transaction.referenceId },
  });

  if (existingWalletTx && existingWalletTx.status === 'CONFIRMED') {
    console.log('[MERCADO_PAGO] Topup já aplicado:', transaction.referenceId);
    return;
  }

  // Buscar ou criar carteira
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        availableCents: 0,
        pendingCents: 0,
      },
    });
  }

  // Creditar saldo
  await prisma.$transaction(async (tx) => {
    // Criar/atualizar transação de carteira
    if (existingWalletTx) {
      await tx.walletTransaction.update({
        where: { id: existingWalletTx.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });
    } else {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'TOPUP',
          status: 'CONFIRMED',
          amountCents: transaction.amountCents,
          title: 'Recarga via Mercado Pago',
          referenceId: transaction.referenceId,
          confirmedAt: new Date(),
          meta: {
            paymentTransactionId: transaction.id,
            externalId: transaction.externalId,
          },
        },
      });
    }

    // Atualizar saldo da carteira
    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents: {
          increment: transaction.amountCents,
        },
      },
    });
  });

  console.log('[MERCADO_PAGO] Topup aplicado com sucesso:', {
    userId,
    amountCents: transaction.amountCents,
    referenceId: transaction.referenceId,
  });
}

/**
 * Marca envios como pagos (placeholder - implementar conforme necessidade)
 */
async function applyCheckoutPayment(transaction: PaymentTransaction): Promise<void> {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  const shipmentId = metadata?.shipmentId as string | undefined;

  if (!shipmentId) {
    console.error('[MERCADO_PAGO] Checkout payment sem shipmentId:', transaction.id);
    return;
  }

  // TODO: Implementar lógica de marcar envio como pago
  console.log('[MERCADO_PAGO] Checkout payment confirmado:', {
    shipmentId,
    amountCents: transaction.amountCents,
  });
}
