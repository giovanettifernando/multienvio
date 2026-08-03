import 'server-only';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import type { PaymentTransaction } from '@prisma/client';
import { prisma as defaultPrisma } from '@/platform/db/db';
import { createCharge, getPixQrCode, getBoletoIdentification, getCharge } from './charges';
import { getOrCreateCustomer } from './customers';
import { toCents } from './money';
import { mapAsaasStatus, mapBillingTypeToMethod } from './status';

export interface CreateAsaasPaymentInput {
  userId: string;
  userName: string;
  userEmail: string;
  userDocument?: string;
  userPhone?: string;
  amountCents: number;
  description: string;
  dueDate: string;
  paymentMethod: 'pix' | 'credit_card' | 'boleto';
  cardToken?: string;
  remoteIp?: string;
  installments?: number;
  metadata: Record<string, string> & {
    type: 'wallet_topup' | 'checkout_payment' | 'recipient_payment';
  };
}

export interface CreateAsaasPaymentResult {
  transaction: PaymentTransaction;
  chargeId: string;
  status: string;
  pixQrCode?: string;
  pixQrCodeImage?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  cardBrand?: string;
  cardLast4?: string;
  invoiceUrl?: string;
}

export interface TrackingDeps {
  prisma?: typeof defaultPrisma;
  createCharge?: typeof createCharge;
  getPixQrCode?: typeof getPixQrCode;
  getBoletoIdentification?: typeof getBoletoIdentification;
  getOrCreateCustomer?: typeof getOrCreateCustomer;
}

export async function createAsaasPaymentWithTracking(
  input: CreateAsaasPaymentInput,
  deps: TrackingDeps = {},
): Promise<CreateAsaasPaymentResult> {
  const db = deps.prisma ?? defaultPrisma;
  const doCreateCharge = deps.createCharge ?? createCharge;
  const doGetPixQrCode = deps.getPixQrCode ?? getPixQrCode;
  const doGetBoleto = deps.getBoletoIdentification ?? getBoletoIdentification;
  const doGetOrCreateCustomer = deps.getOrCreateCustomer ?? getOrCreateCustomer;

  const gateway = await db.paymentGateway.findFirst({
    where: { slug: 'asaas', status: 'ACTIVE' },
  });
  if (!gateway) throw new Error('Gateway Asaas não configurado ou inativo');

  const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
  let customerId = (user as Record<string, unknown>).asaasCustomerId as string | null | undefined;

  if (!customerId) {
    const customer = await doGetOrCreateCustomer({
      name: input.userName,
      email: input.userEmail,
      document: input.userDocument,
      phone: input.userPhone,
    });

    // getOrCreateCustomer consulta o CPF e cria em duas chamadas separadas (não
    // atômicas): duplo clique no botão de pagar ou um retry automático podem
    // concorrer e ambos criarem um cliente no Asaas antes que qualquer gravação
    // no banco termine. A atualização condicional abaixo só grava se o campo
    // ainda estiver vazio — quem perde a corrida releu o usuário e usa o id que
    // já foi persistido pela outra execução, convergindo para um único
    // asaasCustomerId por usuário mesmo que dois clientes tenham sido criados
    // no Asaas.
    const updateResult = await db.user.updateMany({
      where: { id: input.userId, asaasCustomerId: null },
      data: { asaasCustomerId: customer.id },
    });

    if (updateResult.count === 0) {
      const refreshed = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
      customerId = (refreshed as Record<string, unknown>).asaasCustomerId as string;
    } else {
      customerId = customer.id;
    }
  }

  const referenceId = `as_${nanoid(16)}`;

  const transaction = await db.paymentTransaction.create({
    data: {
      gatewayId: gateway.id,
      referenceId,
      userId: input.userId,
      method:
        input.paymentMethod === 'pix'
          ? 'PIX'
          : input.paymentMethod === 'boleto'
            ? 'BOLETO'
            : 'CREDIT_CARD',
      status: 'PENDING',
      amountCents: input.amountCents,
      feeCents: 0,
      netCents: input.amountCents,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });

  try {
    const charge = await doCreateCharge({
      customerId,
      amountCents: input.amountCents,
      description: input.description,
      referenceId,
      dueDate: input.dueDate,
      paymentMethod: input.paymentMethod,
      cardToken: input.cardToken,
      remoteIp: input.remoteIp,
      installments: input.installments,
    });

    const status = mapAsaasStatus(charge.status);
    const netCents = charge.netValue != null ? toCents(charge.netValue) : input.amountCents;

    const result: CreateAsaasPaymentResult = {
      transaction,
      chargeId: charge.id,
      status,
      cardBrand: charge.creditCard?.creditCardBrand,
      cardLast4: charge.creditCard?.creditCardNumber,
      invoiceUrl: charge.invoiceUrl,
    };

    if (input.paymentMethod === 'pix') {
      const qr = await doGetPixQrCode(charge.id);
      result.pixQrCode = qr.payload;
      result.pixQrCodeImage = `data:image/png;base64,${qr.encodedImage}`;
    }

    if (input.paymentMethod === 'boleto') {
      const boleto = await doGetBoleto(charge.id);
      result.boletoUrl = charge.bankSlipUrl;
      result.boletoBarcode = boleto.identificationField;
    }

    const updated = await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        externalId: charge.id,
        status,
        method: mapBillingTypeToMethod(charge.billingType),
        netCents,
        feeCents: input.amountCents - netCents,
        cardBrand: result.cardBrand,
        cardLast4: result.cardLast4,
        pixQrCode: result.pixQrCode,
        boletoUrl: result.boletoUrl,
        boletoBarcode: result.boletoBarcode,
        authorizedAt: status === 'CAPTURED' ? new Date() : undefined,
        paidAt: status === 'PAID' ? new Date() : undefined,
      },
    });

    return { ...result, transaction: updated };
  } catch (error) {
    await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED' },
    });
    throw error;
  }
}

/** Reconsulta a cobrança no Asaas e sincroniza o status da transação local. */
export async function updatePaymentFromAsaas(chargeId: string): Promise<void> {
  const charge = await getCharge(chargeId);
  const status = mapAsaasStatus(charge.status);
  const netCents = charge.netValue != null ? toCents(charge.netValue) : undefined;

  await defaultPrisma.paymentTransaction.updateMany({
    where: { externalId: chargeId },
    data: {
      status,
      ...(netCents != null ? { netCents, feeCents: toCents(charge.value) - netCents } : {}),
      paidAt: status === 'PAID' ? new Date() : undefined,
      authorizedAt: status === 'CAPTURED' ? new Date() : undefined,
    },
  });
}
