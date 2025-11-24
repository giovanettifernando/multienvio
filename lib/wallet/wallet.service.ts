/**
 * Wallet Service
 *
 * Serviço de negócio para gerenciamento de carteira digital.
 * Todas as operações com valores monetários usam centavos internamente.
 */

import { prisma } from '@/lib/db';
import { WalletTxType, WalletTxStatus } from '@prisma/client';

export interface WalletBalance {
  availableCents: number;
  pendingCents: number;
  availableReais: number;
  pendingReais: number;
}

export interface WalletTransactionData {
  id: string;
  type: WalletTxType;
  status: WalletTxStatus;
  amountCents: number;
  amountReais: number;
  title: string | null;
  referenceId: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
}

/**
 * Converte centavos para reais
 */
export function centsToReais(cents: number): number {
  return cents / 100;
}

/**
 * Converte reais para centavos
 */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Obtém ou cria a carteira do usuário
 */
export async function getOrCreateWallet(userId: string) {
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

  return wallet;
}

/**
 * Obtém o saldo da carteira do usuário
 */
export async function getBalance(userId: string): Promise<WalletBalance> {
  const wallet = await getOrCreateWallet(userId);

  return {
    availableCents: wallet.availableCents,
    pendingCents: wallet.pendingCents,
    availableReais: centsToReais(wallet.availableCents),
    pendingReais: centsToReais(wallet.pendingCents),
  };
}

/**
 * Lista transações da carteira com paginação
 */
export async function listTransactions(
  userId: string,
  options: {
    limit?: number;
    cursor?: string;
  } = {}
): Promise<WalletTransactionData[]> {
  const { limit = 20, cursor } = options;

  const wallet = await getOrCreateWallet(userId);

  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Pular o cursor
    }),
  });

  return transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    status: tx.status,
    amountCents: tx.amountCents,
    amountReais: centsToReais(Math.abs(tx.amountCents)),
    title: tx.title,
    referenceId: tx.referenceId,
    createdAt: tx.createdAt,
    confirmedAt: tx.confirmedAt,
  }));
}

/**
 * Debita valor da carteira
 * Valida se há saldo suficiente
 */
export async function debit(
  userId: string,
  amountCents: number,
  title: string,
  referenceId?: string
): Promise<WalletTransactionData> {
  if (amountCents <= 0) {
    throw new Error('O valor do débito deve ser positivo');
  }

  const wallet = await getOrCreateWallet(userId);

  // Validar saldo disponível
  if (wallet.availableCents < amountCents) {
    throw new Error('Saldo insuficiente');
  }

  const now = new Date();

  // Usar transação atômica
  const [transaction] = await prisma.$transaction([
    // Criar transação de débito
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTxType.PURCHASE,
        status: WalletTxStatus.CONFIRMED,
        amountCents: -amountCents, // Negativo para débito
        title,
        referenceId,
        confirmedAt: now,
      },
    }),
    // Atualizar saldo disponível
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents: { decrement: amountCents },
      },
    }),
  ]);

  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amountCents: transaction.amountCents,
    amountReais: centsToReais(Math.abs(transaction.amountCents)),
    title: transaction.title,
    referenceId: transaction.referenceId,
    createdAt: transaction.createdAt,
    confirmedAt: transaction.confirmedAt,
  };
}

/**
 * Cria um reembolso (crédito) na carteira
 */
export async function refund(
  userId: string,
  amountCents: number,
  title: string,
  referenceId?: string
): Promise<WalletTransactionData> {
  if (amountCents <= 0) {
    throw new Error('O valor do reembolso deve ser positivo');
  }

  const wallet = await getOrCreateWallet(userId);
  const now = new Date();

  // Usar transação atômica
  const [transaction] = await prisma.$transaction([
    // Criar transação de reembolso
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTxType.REFUND,
        status: WalletTxStatus.CONFIRMED,
        amountCents, // Positivo para crédito
        title,
        referenceId,
        confirmedAt: now,
      },
    }),
    // Atualizar saldo disponível
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents: { increment: amountCents },
      },
    }),
  ]);

  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amountCents: transaction.amountCents,
    amountReais: centsToReais(Math.abs(transaction.amountCents)),
    title: transaction.title,
    referenceId: transaction.referenceId,
    createdAt: transaction.createdAt,
    confirmedAt: transaction.confirmedAt,
  };
}

/**
 * ========================================================================
 * DOMÍNIO: Créditos de Gateway
 * ========================================================================
 *
 * Essas funções são chamadas APENAS por serviços de integração de pagamento
 * (ex: lib/mercadopago) quando um pagamento externo é confirmado.
 *
 * NUNCA devem ser chamadas diretamente por rotas API ou controllers.
 */

export interface CreditFromGatewayTopupParams {
  userId: string;
  amountCents: number;
  paymentTransactionId: string;
  currency?: string;
  providerPaymentId?: string;
}

/**
 * Credita saldo na carteira a partir de um pagamento confirmado no gateway
 *
 * Regras de negócio:
 * - Valida se PaymentTransaction existe e está PAID
 * - Garante idempotência: não aplica crédito duas vezes para o mesmo pagamento
 * - Cria WalletTransaction com type="TOPUP" e reason="gateway_topup"
 * - Atualiza saldo da Wallet
 *
 * @param params Parâmetros do crédito
 * @returns Transação de carteira criada
 * @throws Error se PaymentTransaction não existe ou já foi aplicada
 */
export async function creditFromGatewayTopup(
  params: CreditFromGatewayTopupParams
): Promise<WalletTransactionData> {
  const { userId, amountCents, paymentTransactionId, currency = 'BRL', providerPaymentId } = params;

  if (amountCents <= 0) {
    throw new Error('O valor do crédito deve ser positivo');
  }

  // 1. Validar se PaymentTransaction existe
  const paymentTx = await prisma.paymentTransaction.findUnique({
    where: { id: paymentTransactionId },
  });

  if (!paymentTx) {
    throw new Error(`PaymentTransaction não encontrada: ${paymentTransactionId}`);
  }

  if (paymentTx.status !== 'PAID') {
    throw new Error(`PaymentTransaction não está PAID: ${paymentTx.status}`);
  }

  // 2. Verificar idempotência: já existe WalletTransaction para este pagamento?
  const existingWalletTx = await prisma.walletTransaction.findFirst({
    where: {
      meta: {
        path: ['paymentTransactionId'],
        equals: paymentTransactionId,
      },
      status: WalletTxStatus.CONFIRMED,
    },
  });

  if (existingWalletTx) {
    console.log('[WALLET_SERVICE] Crédito já aplicado (idempotência):', {
      paymentTransactionId,
      walletTransactionId: existingWalletTx.id,
    });

    return {
      id: existingWalletTx.id,
      type: existingWalletTx.type,
      status: existingWalletTx.status,
      amountCents: existingWalletTx.amountCents,
      amountReais: centsToReais(Math.abs(existingWalletTx.amountCents)),
      title: existingWalletTx.title,
      referenceId: existingWalletTx.referenceId,
      createdAt: existingWalletTx.createdAt,
      confirmedAt: existingWalletTx.confirmedAt,
    };
  }

  // 3. Buscar ou criar carteira
  const wallet = await getOrCreateWallet(userId);
  const now = new Date();

  // 4. Criar transação de crédito + atualizar saldo (transação atômica)
  const [walletTx] = await prisma.$transaction([
    // Criar WalletTransaction
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTxType.TOPUP,
        status: WalletTxStatus.CONFIRMED,
        amountCents,
        title: `Recarga confirmada - R$ ${centsToReais(amountCents).toFixed(2)}`,
        referenceId: paymentTx.referenceId,
        confirmedAt: now,
        meta: {
          paymentTransactionId,
          externalId: providerPaymentId || paymentTx.externalId,
          currency,
          source: 'gateway_topup',
        },
      },
    }),
    // Atualizar saldo da carteira
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents: { increment: amountCents },
      },
    }),
  ]);

  console.log('[WALLET_SERVICE] Crédito de gateway aplicado:', {
    userId,
    walletTransactionId: walletTx.id,
    amountCents,
    paymentTransactionId,
  });

  return {
    id: walletTx.id,
    type: walletTx.type,
    status: walletTx.status,
    amountCents: walletTx.amountCents,
    amountReais: centsToReais(Math.abs(walletTx.amountCents)),
    title: walletTx.title,
    referenceId: walletTx.referenceId,
    createdAt: walletTx.createdAt,
    confirmedAt: walletTx.confirmedAt,
  };
}

/**
 * ========================================================================
 * DOMÍNIO: Créditos Manuais (Admin)
 * ========================================================================
 */

export interface ManualCreditParams {
  userId: string;
  amountCents: number;
  reason?: string;
  createdByAdminId: string;
  referenceId?: string;
}

/**
 * Credita saldo manualmente na carteira (ajustes, cortesias, compensações)
 *
 * Regras de negócio:
 * - Apenas admins podem fazer créditos manuais
 * - Não há PaymentTransaction associada (origem manual)
 * - Cria WalletTransaction com type="TOPUP" e origin="manual"
 * - Registra quem fez o crédito (createdByAdminId)
 *
 * @param params Parâmetros do crédito manual
 * @returns Transação de carteira criada
 */
export async function manualCredit(
  params: ManualCreditParams
): Promise<WalletTransactionData> {
  const { userId, amountCents, reason = 'Crédito manual', createdByAdminId, referenceId } = params;

  if (amountCents <= 0) {
    throw new Error('O valor do crédito deve ser positivo');
  }

  const wallet = await getOrCreateWallet(userId);
  const now = new Date();

  // Criar transação de crédito + atualizar saldo (transação atômica)
  const [walletTx] = await prisma.$transaction([
    // Criar WalletTransaction
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTxType.TOPUP,
        status: WalletTxStatus.CONFIRMED,
        amountCents,
        title: reason,
        referenceId,
        confirmedAt: now,
        meta: {
          origin: 'manual',
          createdByAdminId,
          reason,
        },
      },
    }),
    // Atualizar saldo da carteira
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents: { increment: amountCents },
      },
    }),
  ]);

  console.log('[WALLET_SERVICE] Crédito manual aplicado:', {
    userId,
    walletTransactionId: walletTx.id,
    amountCents,
    createdByAdminId,
    reason,
  });

  return {
    id: walletTx.id,
    type: walletTx.type,
    status: walletTx.status,
    amountCents: walletTx.amountCents,
    amountReais: centsToReais(Math.abs(walletTx.amountCents)),
    title: walletTx.title,
    referenceId: walletTx.referenceId,
    createdAt: walletTx.createdAt,
    confirmedAt: walletTx.confirmedAt,
  };
}

/**
 * Débito manual na carteira (ajustes, correções)
 *
 * Usado para ajustes administrativos quando necessário debitar manualmente
 */
export interface ManualDebitParams {
  userId: string;
  amountCents: number;
  reason?: string;
  createdByAdminId: string;
  referenceId?: string;
}

export async function manualDebit(
  params: ManualDebitParams
): Promise<WalletTransactionData> {
  const { userId, amountCents, reason = 'Débito manual', createdByAdminId, referenceId } = params;

  if (amountCents <= 0) {
    throw new Error('O valor do débito deve ser positivo');
  }

  const wallet = await getOrCreateWallet(userId);

  // Validar saldo disponível
  if (wallet.availableCents < amountCents) {
    throw new Error('Saldo insuficiente para débito manual');
  }

  const now = new Date();

  // Criar transação de débito + atualizar saldo (transação atômica)
  const [walletTx] = await prisma.$transaction([
    // Criar WalletTransaction
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTxType.PURCHASE,
        status: WalletTxStatus.CONFIRMED,
        amountCents: -amountCents, // Negativo para débito
        title: reason,
        referenceId,
        confirmedAt: now,
        meta: {
          origin: 'manual',
          createdByAdminId,
          reason,
        },
      },
    }),
    // Atualizar saldo da carteira
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        availableCents: { decrement: amountCents },
      },
    }),
  ]);

  console.log('[WALLET_SERVICE] Débito manual aplicado:', {
    userId,
    walletTransactionId: walletTx.id,
    amountCents,
    createdByAdminId,
    reason,
  });

  return {
    id: walletTx.id,
    type: walletTx.type,
    status: walletTx.status,
    amountCents: walletTx.amountCents,
    amountReais: centsToReais(Math.abs(walletTx.amountCents)),
    title: walletTx.title,
    referenceId: walletTx.referenceId,
    createdAt: walletTx.createdAt,
    confirmedAt: walletTx.confirmedAt,
  };
}
