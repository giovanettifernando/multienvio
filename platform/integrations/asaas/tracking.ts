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
      const persisted = (refreshed as Record<string, unknown>).asaasCustomerId;

      // Estado impossível: perdemos a corrida (count === 0 só ocorre quando o
      // campo deixou de ser null), então a releitura tem de trazer um id. Falhar
      // alto aqui é melhor que mandar `undefined` como cliente para o Asaas.
      if (typeof persisted !== 'string' || !persisted) {
        throw new Error(
          'Não foi possível determinar o cliente Asaas do usuário após concorrência na criação',
        );
      }
      customerId = persisted;
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

  // Só a CRIAÇÃO da cobrança pode marcar a transação como FAILED. Depois que o
  // Asaas aceita a cobrança, ela existe e é pagável — inclusive fora do nosso
  // app, porque o Asaas notifica o cliente por e-mail com o link. A partir daí,
  // marcar FAILED criaria uma cobrança paga que o sistema nunca reconheceria.
  let charge;
  try {
    charge = await doCreateCharge({
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
  } catch (error) {
    await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED' },
    });
    throw error;
  }

  const status = mapAsaasStatus(charge.status);
  const netCents = charge.netValue != null ? toCents(charge.netValue) : input.amountCents;
  // A taxa é a diferença entre bruto e líquido. Nunca deixar negativa: um
  // netValue maior que o value seria resposta inesperada da API, e taxa
  // negativa contaminaria relatório financeiro.
  const feeCents = Math.max(0, input.amountCents - netCents);

  // Persistir o externalId AGORA, antes de qualquer chamada secundária. É o que
  // liga a cobrança do Asaas à nossa transação: sem ele, updatePaymentFromAsaas
  // (que filtra por externalId) nunca encontraria a transação e um pagamento
  // real ficaria invisível para o sistema.
  let transactionRecord = await db.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      externalId: charge.id,
      status,
      method: mapBillingTypeToMethod(charge.billingType),
      netCents,
      feeCents,
      cardBrand: charge.creditCard?.creditCardBrand,
      cardLast4: charge.creditCard?.creditCardNumber,
      boletoUrl: charge.bankSlipUrl,
      authorizedAt: status === 'CAPTURED' ? new Date() : undefined,
      paidAt: status === 'PAID' ? new Date() : undefined,
    },
  });

  const result: CreateAsaasPaymentResult = {
    transaction: transactionRecord,
    chargeId: charge.id,
    status,
    cardBrand: charge.creditCard?.creditCardBrand,
    cardLast4: charge.creditCard?.creditCardNumber,
    invoiceUrl: charge.invoiceUrl,
    boletoUrl: charge.bankSlipUrl,
  };

  // QR Code e linha digitável são dados de EXIBIÇÃO de uma cobrança que já é
  // válida. Se a busca falhar, registramos e seguimos: o cliente ainda paga
  // pelo invoiceUrl, e o status será sincronizado depois pelo webhook ou pelo
  // monitor de pendências.
  if (input.paymentMethod === 'pix') {
    try {
      const qr = await doGetPixQrCode(charge.id);
      result.pixQrCode = qr.payload;
      result.pixQrCodeImage = `data:image/png;base64,${qr.encodedImage}`;
    } catch (error) {
      console.error(
        `[ASAAS_TRACKING] Falha ao obter QR Code do PIX da cobrança ${charge.id} (cobrança segue válida):`,
        error,
      );
    }
  }

  if (input.paymentMethod === 'boleto') {
    try {
      const boleto = await doGetBoleto(charge.id);
      result.boletoBarcode = boleto.identificationField;
    } catch (error) {
      console.error(
        `[ASAAS_TRACKING] Falha ao obter a linha digitável da cobrança ${charge.id} (boleto segue válido):`,
        error,
      );
    }
  }

  if (result.pixQrCode || result.boletoBarcode) {
    transactionRecord = await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        pixQrCode: result.pixQrCode,
        boletoBarcode: result.boletoBarcode,
      },
    });
  }

  return { ...result, transaction: transactionRecord };
}

export interface UpdatePaymentDeps {
  prisma?: typeof defaultPrisma;
  getCharge?: typeof getCharge;
}

/**
 * Reconsulta a cobrança no Asaas e sincroniza o status da transação local.
 *
 * É por aqui que o webhook e o monitor de pendências refletem um pagamento.
 * O filtro é `externalId` — por isso `createAsaasPaymentWithTracking` grava esse
 * campo assim que a cobrança nasce: sem ele, nada aqui encontra a transação.
 */
export async function updatePaymentFromAsaas(
  chargeId: string,
  deps: UpdatePaymentDeps = {},
): Promise<void> {
  const db = deps.prisma ?? defaultPrisma;
  const doGetCharge = deps.getCharge ?? getCharge;

  const charge = await doGetCharge(chargeId);
  const status = mapAsaasStatus(charge.status);
  const netCents = charge.netValue != null ? toCents(charge.netValue) : undefined;

  await db.paymentTransaction.updateMany({
    where: { externalId: chargeId },
    data: {
      status,
      ...(netCents != null
        ? { netCents, feeCents: Math.max(0, toCents(charge.value) - netCents) }
        : {}),
      paidAt: status === 'PAID' ? new Date() : undefined,
      authorizedAt: status === 'CAPTURED' ? new Date() : undefined,
    },
  });
}
