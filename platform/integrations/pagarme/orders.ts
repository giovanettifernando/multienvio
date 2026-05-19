import 'server-only';
import { pagarmeRequest } from './client';
import type { PagarmeOrder, PagarmeOrderItem } from './types';
import type { TransactionStatus, PaymentMethod } from '@prisma/client';

export interface CreateOrderInput {
  amountCents: number;
  description: string;
  referenceId: string;
  customerId: string;
  paymentMethod: 'credit_card' | 'pix';
  cardToken?: string;
  cardId?: string;
  installments?: number;
  pixExpiresIn?: number;
  metadata?: Record<string, string>;
}

export interface ProcessedOrderData {
  externalId: string;
  status: TransactionStatus;
  amountCents: number;
  method: PaymentMethod;
  cardBrand?: string;
  cardLast4?: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  paidAt?: Date;
  chargeId?: string;
}

export function processOrderData(order: PagarmeOrder): ProcessedOrderData {
  const charge = order.charges?.[0];
  const tx = charge?.last_transaction;

  const statusMap: Record<string, TransactionStatus> = {
    paid: 'PAID',
    pending: 'PENDING',
    canceled: 'CANCELED',
    failed: 'FAILED',
  };
  const txStatusMap: Record<string, TransactionStatus> = {
    paid: 'PAID',
    waiting_payment: 'PENDING',
    refunded: 'REFUNDED',
    not_authorized: 'FAILED',
    error_on_voiding: 'FAILED',
  };

  const status: TransactionStatus =
    txStatusMap[tx?.status ?? ''] ??
    statusMap[charge?.status ?? ''] ??
    statusMap[order.status] ??
    'PENDING';

  const method: PaymentMethod =
    charge?.payment_method === 'pix'
      ? 'PIX'
      : charge?.payment_method === 'debit_card'
        ? 'DEBIT_CARD'
        : 'CREDIT_CARD';

  const card = tx?.card;
  const cardBrand = card?.brand?.toUpperCase();
  const cardLast4 = card?.last_four_digits;

  return {
    externalId: order.id,
    chargeId: charge?.id,
    status,
    amountCents: order.amount,
    method,
    cardBrand,
    cardLast4,
    pixQrCode: tx?.qr_code,
    pixQrCodeUrl: tx?.qr_code_url,
    paidAt: status === 'PAID' ? new Date(order.updated_at) : undefined,
  };
}

export async function createOrder(input: CreateOrderInput): Promise<PagarmeOrder> {
  const items: PagarmeOrderItem[] = [
    {
      amount: input.amountCents,
      description: input.description,
      quantity: 1,
      code: input.referenceId,
    },
  ];

  const payment: Record<string, unknown> = {
    payment_method: input.paymentMethod,
  };

  if (input.paymentMethod === 'credit_card') {
    const cc: Record<string, unknown> = {
      installments: input.installments ?? 1,
      statement_descriptor: 'ENVIO LEGAL',
    };
    if (input.cardToken) cc.card_token = input.cardToken;
    else if (input.cardId) cc.card_id = input.cardId;
    else throw new Error('createOrder: credit_card requires cardToken or cardId');
    payment.credit_card = cc;
  } else {
    payment.pix = { expires_in: input.pixExpiresIn ?? 1800 };
  }

  const body: Record<string, unknown> = {
    items,
    customer_id: input.customerId,
    payments: [payment],
    metadata: input.metadata ?? {},
  };

  return pagarmeRequest<PagarmeOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getOrder(orderId: string): Promise<PagarmeOrder> {
  return pagarmeRequest<PagarmeOrder>(`/orders/${orderId}`);
}

export async function cancelCharge(chargeId: string, amountCents?: number): Promise<unknown> {
  const body = amountCents != null ? JSON.stringify({ amount: amountCents }) : undefined;
  return pagarmeRequest<unknown>(`/charges/${chargeId}`, {
    method: 'DELETE',
    body,
  });
}
