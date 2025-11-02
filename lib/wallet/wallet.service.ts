/**
 * Wallet Service
 *
 * Serviço de negócio para gerenciamento de carteira digital.
 * Todas as operações com valores monetários usam centavos internamente.
 */

import prisma from '@/lib/db';
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

export interface CreateTopupResult {
  transactionId: string;
  referenceId: string;
  amountCents: number;
  qrCode: string;
  status: WalletTxStatus;
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
 * Cria uma recarga (topup) pendente
 * Idempotente por referenceId
 */
export async function createTopupPending(
  userId: string,
  amountCents: number,
  referenceId: string
): Promise<CreateTopupResult> {
  if (amountCents <= 0) {
    throw new Error('O valor da recarga deve ser positivo');
  }

  const wallet = await getOrCreateWallet(userId);

  // Verificar se já existe uma transação com esse referenceId (idempotência)
  const existingTx = await prisma.walletTransaction.findUnique({
    where: { referenceId },
  });

  if (existingTx) {
    // Retornar a transação existente (idempotência)
    return {
      transactionId: existingTx.id,
      referenceId: existingTx.referenceId!,
      amountCents: existingTx.amountCents,
      qrCode: generateMockQRCode(existingTx.referenceId!),
      status: existingTx.status,
    };
  }

  // Criar nova transação pendente
  const transaction = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: WalletTxType.TOPUP,
      status: WalletTxStatus.PENDING,
      amountCents,
      title: `Recarga via PIX - R$ ${centsToReais(amountCents).toFixed(2)}`,
      referenceId,
      meta: {
        method: 'pix',
      },
    },
  });

  // Atualizar saldo pendente
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      pendingCents: { increment: amountCents },
    },
  });

  return {
    transactionId: transaction.id,
    referenceId: transaction.referenceId!,
    amountCents: transaction.amountCents,
    qrCode: generateMockQRCode(transaction.referenceId!),
    status: transaction.status,
  };
}

/**
 * Confirma uma transação pendente (mock de webhook)
 * Move o saldo de pendente para disponível
 */
export async function confirmTransaction(referenceId: string): Promise<void> {
  const transaction = await prisma.walletTransaction.findUnique({
    where: { referenceId },
    include: { wallet: true },
  });

  if (!transaction) {
    throw new Error('Transação não encontrada');
  }

  if (transaction.status !== WalletTxStatus.PENDING) {
    throw new Error('Transação já foi processada');
  }

  const now = new Date();

  // Usar transação atômica para garantir consistência
  await prisma.$transaction([
    // Atualizar status da transação
    prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: WalletTxStatus.CONFIRMED,
        confirmedAt: now,
      },
    }),
    // Atualizar saldos da carteira (pendente -> disponível)
    prisma.wallet.update({
      where: { id: transaction.walletId },
      data: {
        availableCents: { increment: transaction.amountCents },
        pendingCents: { decrement: transaction.amountCents },
      },
    }),
  ]);
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
 * Gera um QR Code PIX mock para testes
 * Em produção, seria integrado com um gateway de pagamento real
 */
function generateMockQRCode(referenceId: string): string {
  // Mock: em produção, seria o payload PIX real
  const pixPayload = `00020126580014br.gov.bcb.pix0136${referenceId}520400005303986540510.005802BR5925ENVIO LEGAL LTDA6009SAO PAULO62070503***6304`;
  return Buffer.from(pixPayload).toString('base64');
}
