import 'server-only';
import { prisma } from '@/platform/db/db';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { createOrder, processOrderData, getOrder } from './orders';
import { getOrCreateCustomer } from './customers';
import type { CreateOrderInput } from './orders';
import type { PaymentTransaction } from '@prisma/client';
import * as walletService from '@/modules/wallet/application/wallet.service';

export interface CreatePagarmePaymentInput extends Omit<CreateOrderInput, 'customerId'> {
  userId: string;
  userName: string;
  userEmail: string;
  userDocument?: string;
  userPhone?: string;
  metadata: Record<string, string> & { type: 'wallet_topup' | 'checkout_payment' };
}

export interface CreatePagarmePaymentResult {
  transaction: PaymentTransaction;
  orderId: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  cardBrand?: string;
  cardLast4?: string;
  status: string;
}

export async function createPagarmePaymentWithTracking(
  input: CreatePagarmePaymentInput,
): Promise<CreatePagarmePaymentResult> {
  const gateway = await prisma.paymentGateway.findFirst({
    where: { slug: 'pagarme', status: 'ACTIVE' },
  });
  if (!gateway) throw new Error('Gateway Pagar.me não configurado ou inativo');

  // Ensure customer exists in Pagar.me, store ID on User
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  let customerId = (user as Record<string, unknown>).pagarmeCustomerId as string | undefined;

  if (!customerId) {
    const customer = await getOrCreateCustomer({
      userId: input.userId,
      name: input.userName,
      email: input.userEmail,
      document: input.userDocument,
      phone: input.userPhone,
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: input.userId },
      data: { pagarmeCustomerId: customerId } as Prisma.UserUpdateInput,
    });
  }

  const referenceId = `pm_${nanoid(16)}`;

  const transaction = await prisma.paymentTransaction.create({
    data: {
      gatewayId: gateway.id,
      referenceId,
      userId: input.userId,
      method: input.paymentMethod === 'pix' ? 'PIX' : 'CREDIT_CARD',
      status: 'PENDING',
      amountCents: input.amountCents,
      feeCents: 0,
      netCents: input.amountCents,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });

  try {
    const order = await createOrder({ ...input, customerId, referenceId });
    const processed = processOrderData(order);

    const updated = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        externalId: processed.externalId,
        status: processed.status,
        cardBrand: processed.cardBrand,
        cardLast4: processed.cardLast4,
        pixQrCode: processed.pixQrCode,
        paidAt: processed.paidAt,
        metadata: {
          ...(input.metadata as object),
          chargeId: processed.chargeId,
          pixQrCodeUrl: processed.pixQrCodeUrl,
        } as Prisma.InputJsonValue,
      },
    });

    if (processed.status === 'PAID') {
      await applyPaymentEffects(updated);
    }

    return {
      transaction: updated,
      orderId: order.id,
      pixQrCode: processed.pixQrCode,
      pixQrCodeUrl: processed.pixQrCodeUrl,
      cardBrand: processed.cardBrand,
      cardLast4: processed.cardLast4,
      status: processed.status,
    };
  } catch (err) {
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED' },
    });
    throw err;
  }
}

export async function updatePaymentFromPagarme(
  orderId: string,
): Promise<PaymentTransaction> {
  const order = await getOrder(orderId);
  const processed = processOrderData(order);

  let transaction = await prisma.paymentTransaction.findFirst({
    where: { externalId: orderId },
  });

  if (!transaction) {
    const gateway = await prisma.paymentGateway.findFirst({
      where: { slug: 'pagarme', status: 'ACTIVE' },
    });
    if (!gateway) throw new Error('Gateway Pagar.me não encontrado');
    transaction = await prisma.paymentTransaction.create({
      data: {
        gatewayId: gateway.id,
        externalId: orderId,
        referenceId: `pm_webhook_${nanoid(16)}`,
        method: processed.method,
        status: processed.status,
        amountCents: processed.amountCents,
        feeCents: 0,
        netCents: processed.amountCents,
        cardBrand: processed.cardBrand,
        cardLast4: processed.cardLast4,
        pixQrCode: processed.pixQrCode,
        paidAt: processed.paidAt,
        metadata: {} as Prisma.InputJsonValue,
      },
    });

    if (processed.status === 'PAID') {
      await applyPaymentEffects(transaction);
    }
    return transaction;
  }

  const wasAlreadyPaid = transaction.status === 'PAID';
  transaction = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: processed.status,
      cardBrand: processed.cardBrand,
      cardLast4: processed.cardLast4,
      pixQrCode: processed.pixQrCode,
      paidAt: processed.paidAt,
    },
  });

  if (processed.status === 'PAID' && !wasAlreadyPaid) {
    await applyPaymentEffects(transaction);
  }
  return transaction;
}

async function applyPaymentEffects(transaction: PaymentTransaction): Promise<void> {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  if (!metadata?.type) return;

  try {
    if (metadata.type === 'wallet_topup') {
      const userId = transaction.userId || (metadata.userId as string | undefined);
      if (!userId) return;
      await walletService.creditFromGatewayTopup({
        userId,
        amountCents: transaction.amountCents,
        paymentTransactionId: transaction.id,
        currency: 'BRL',
        providerPaymentId: transaction.externalId || undefined,
      });
    } else if (metadata.type === 'checkout_payment') {
      await applyCheckoutPayment(transaction);
    }
  } catch (err) {
    console.error('[PAGARME] Erro ao aplicar efeitos de pagamento:', err);
  }
}

async function applyCheckoutPayment(transaction: PaymentTransaction): Promise<void> {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  const singleId = metadata?.shipmentId as string | undefined;
  const batchIds = metadata?.shipmentIds as string[] | undefined;
  const shipmentIds = singleId ? [singleId] : (batchIds ?? []);
  if (shipmentIds.length === 0 || !transaction.userId) return;

  const shipments = await prisma.shipment.findMany({
    where: { id: { in: shipmentIds }, senderId: transaction.userId },
    select: { id: true, paymentMethod: true, document: true },
  });
  if (shipments.length !== shipmentIds.length) return;

  await prisma.$transaction(async (tx) => {
    for (const ship of shipments) {
      if (ship.paymentMethod === 'PAGARME') continue;
      const doc = (ship.document as Record<string, unknown>) ?? {};
      await tx.shipment.update({
        where: { id: ship.id },
        data: {
          paymentMethod: 'PAGARME',
          document: {
            ...doc,
            payment: {
              status: 'approved',
              method: 'pagarme',
              confirmedAt: new Date().toISOString(),
              paymentTransactionId: transaction.id,
              externalId: transaction.externalId,
              amount: transaction.amountCents / 100,
            },
          },
        },
      });
      const label = await tx.label.findUnique({ where: { shipmentId: ship.id } });
      if (label && label.status !== 'issued') {
        await tx.label.update({ where: { id: label.id }, data: { status: 'issued' } });
      }
    }
  });
}
