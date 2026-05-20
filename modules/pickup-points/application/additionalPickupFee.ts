/**
 * Serviço de cobrança de taxa adicional de coleta
 *
 * Quando um coletor registra uma tentativa sem sucesso (retry),
 * uma taxa adicional de coleta deve ser cobrada do usuário.
 *
 * Ordem de cobrança:
 * 1. Saldo da carteira
 * 2. Cartão de crédito principal
 * 3. Outros cartões de crédito
 * 4. Débito forçado na carteira (saldo negativo)
 */

import { prisma } from '@/platform/db/db';
import { WalletTxType, WalletTxStatus } from '@prisma/client';
import { getOrCreateWallet, centsToReais } from '@/modules/wallet/application/wallet.service';
import { calculatePickupFee } from './pickupFee';

export interface ChargeAdditionalPickupFeeResult {
  success: boolean;
  method: 'wallet' | 'card' | 'negative_balance';
  amountCents: number;
  walletTransactionId?: string;
  cardPaymentId?: string;
  newBalanceCents: number;
  message: string;
}

export interface ChargeAdditionalPickupFeeParams {
  pickupRequestId: string;
  userId: string;
  shipmentId: string;
  attemptNumber: number;
  originCep: string;
}

/**
 * Cobra taxa adicional de coleta após tentativa sem sucesso
 *
 * Prioridade:
 * 1. Carteira (se tiver saldo)
 * 2. Cartão principal
 * 3. Outros cartões
 * 4. Débito forçado (saldo negativo)
 */
export async function chargeAdditionalPickupFee(
  params: ChargeAdditionalPickupFeeParams
): Promise<ChargeAdditionalPickupFeeResult> {
  const { pickupRequestId, userId, shipmentId, attemptNumber, originCep } = params;

  console.log('[ADDITIONAL_PICKUP_FEE] Iniciando cobrança:', {
    pickupRequestId,
    userId,
    attemptNumber,
  });

  // 1. Calcular o valor da taxa adicional de coleta
  // Usa a mesma lógica da taxa inicial para calcular
  const pickupFeeResult = await calculatePickupFee(originCep, 0);

  if (!pickupFeeResult.success) {
    // Se não conseguir calcular, usar valor fixo padrão
    console.warn('[ADDITIONAL_PICKUP_FEE] Não foi possível calcular taxa, usando valor padrão');
  }

  // Valor da taxa adicional (mesma taxa da coleta inicial)
  const feeAmountCents = pickupFeeResult.success
    ? Math.round(pickupFeeResult.feeAmount * 100)
    : 1500; // R$ 15,00 como fallback

  // 2. Buscar carteira do usuário
  const wallet = await getOrCreateWallet(userId);
  const availableBalance = wallet.availableCents;

  // 3. Tentar cobrar da carteira
  if (availableBalance >= feeAmountCents) {
    return await chargeFromWallet(
      wallet.id,
      userId,
      feeAmountCents,
      pickupRequestId,
      attemptNumber
    );
  }

  // 4. Tentar cobrar do cartão principal
  const cardResult = await tryChargeFromCards(userId, feeAmountCents, pickupRequestId);
  if (cardResult.success) {
    // Atualizar carteira para refletir o pagamento
    const newBalance = await getOrCreateWallet(userId);
    return {
      ...cardResult,
      newBalanceCents: newBalance.availableCents,
    };
  }

  // 5. Último recurso: débito forçado (saldo negativo)
  return await forceDebitFromWallet(
    wallet.id,
    userId,
    feeAmountCents,
    pickupRequestId,
    attemptNumber,
    availableBalance
  );
}

/**
 * Cobra da carteira quando há saldo suficiente
 */
async function chargeFromWallet(
  walletId: string,
  userId: string,
  amountCents: number,
  pickupRequestId: string,
  attemptNumber: number
): Promise<ChargeAdditionalPickupFeeResult> {
  const now = new Date();

  const [walletTx, updatedWallet] = await prisma.$transaction([
    // Criar transação de débito
    prisma.walletTransaction.create({
      data: {
        walletId,
        type: WalletTxType.PURCHASE,
        status: WalletTxStatus.CONFIRMED,
        amountCents: -amountCents,
        title: `Taxa de coleta adicional (tentativa ${attemptNumber})`,
        referenceId: pickupRequestId,
        confirmedAt: now,
        meta: {
          type: 'additional_pickup_fee',
          attemptNumber,
          pickupRequestId,
        },
      },
    }),
    // Atualizar saldo
    prisma.wallet.update({
      where: { id: walletId },
      data: {
        availableCents: { decrement: amountCents },
      },
    }),
  ]);

  console.log('[ADDITIONAL_PICKUP_FEE] Cobrado da carteira:', {
    walletTransactionId: walletTx.id,
    amountCents,
    newBalance: updatedWallet.availableCents,
  });

  return {
    success: true,
    method: 'wallet',
    amountCents,
    walletTransactionId: walletTx.id,
    newBalanceCents: updatedWallet.availableCents,
    message: `Taxa de coleta adicional de R$ ${centsToReais(amountCents).toFixed(2)} cobrada da carteira`,
  };
}

/**
 * Tenta cobrar dos cartões de crédito salvos
 */
async function tryChargeFromCards(
  userId: string,
  amountCents: number,
  pickupRequestId: string
): Promise<ChargeAdditionalPickupFeeResult> {
  // Buscar cartões salvos, ordenados por default primeiro
  const cards = await prisma.card.findMany({
    where: {
      userId,
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  if (cards.length === 0) {
    console.log('[ADDITIONAL_PICKUP_FEE] Usuário não tem cartões salvos');
    return {
      success: false,
      method: 'card',
      amountCents,
      newBalanceCents: 0,
      message: 'Nenhum cartão disponível',
    };
  }

  // Tentar cada cartão
  for (const card of cards) {
    try {
      console.log('[ADDITIONAL_PICKUP_FEE] Tentando cobrar do cartão:', {
        cardId: card.id,
        last4: card.last4,
        brand: card.brand,
      });

      // TODO: Implementar cobrança real via Pagar.me
      // Por enquanto, simular falha para ir para o fallback
      // const paymentResult = await chargeSavedCard(card, amountCents, {
      //   description: `Taxa de coleta adicional`,
      //   referenceId: pickupRequestId,
      // });

      // if (paymentResult.success) {
      //   return {
      //     success: true,
      //     method: 'card',
      //     amountCents,
      //     cardPaymentId: paymentResult.paymentId,
      //     newBalanceCents: 0,
      //     message: `Taxa cobrada do cartão final ${card.last4}`,
      //   };
      // }

      console.log('[ADDITIONAL_PICKUP_FEE] Cobrança de cartão ainda não implementada, pulando...');
    } catch (error) {
      console.error('[ADDITIONAL_PICKUP_FEE] Erro ao cobrar cartão:', {
        cardId: card.id,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }

  return {
    success: false,
    method: 'card',
    amountCents,
    newBalanceCents: 0,
    message: 'Não foi possível cobrar de nenhum cartão',
  };
}

/**
 * Débito forçado - permite saldo negativo
 */
async function forceDebitFromWallet(
  walletId: string,
  userId: string,
  amountCents: number,
  pickupRequestId: string,
  attemptNumber: number,
  currentBalance: number
): Promise<ChargeAdditionalPickupFeeResult> {
  const now = new Date();
  const newBalance = currentBalance - amountCents;

  const [walletTx, updatedWallet] = await prisma.$transaction([
    // Criar transação de débito (mesmo com saldo insuficiente)
    prisma.walletTransaction.create({
      data: {
        walletId,
        type: WalletTxType.PURCHASE,
        status: WalletTxStatus.CONFIRMED,
        amountCents: -amountCents,
        title: `Taxa de coleta adicional (tentativa ${attemptNumber})`,
        referenceId: pickupRequestId,
        confirmedAt: now,
        meta: {
          type: 'additional_pickup_fee',
          attemptNumber,
          pickupRequestId,
          forcedDebit: true,
          previousBalance: currentBalance,
        },
      },
    }),
    // Forçar atualização do saldo (pode ficar negativo)
    prisma.wallet.update({
      where: { id: walletId },
      data: {
        availableCents: newBalance,
      },
    }),
  ]);

  console.log('[ADDITIONAL_PICKUP_FEE] Débito forçado aplicado:', {
    walletTransactionId: walletTx.id,
    amountCents,
    previousBalance: currentBalance,
    newBalance: updatedWallet.availableCents,
  });

  return {
    success: true,
    method: 'negative_balance',
    amountCents,
    walletTransactionId: walletTx.id,
    newBalanceCents: updatedWallet.availableCents,
    message: `Taxa de R$ ${centsToReais(amountCents).toFixed(2)} debitada. Saldo negativo de R$ ${centsToReais(Math.abs(newBalance)).toFixed(2)} pendente de regularização.`,
  };
}

/**
 * Verifica se usuário tem saldo negativo
 */
export async function hasNegativeBalance(userId: string): Promise<boolean> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { availableCents: true },
  });

  return (wallet?.availableCents ?? 0) < 0;
}

/**
 * Obtém o valor do saldo negativo em centavos
 */
export async function getNegativeBalanceAmount(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { availableCents: true },
  });

  const balance = wallet?.availableCents ?? 0;
  return balance < 0 ? Math.abs(balance) : 0;
}
