/**
 * Serviço de pagamentos via Mercado Pago
 *
 * Responsável APENAS por:
 * - Criar pagamentos e registrar no banco (PaymentTransaction)
 * - Atualizar status de pagamentos
 * - Integrar com SDK do Mercado Pago
 *
 * NÃO É RESPONSÁVEL POR:
 * - Mexer em Wallet ou WalletTransaction (isso é responsabilidade do wallet service)
 * - Calcular saldo ou montar extrato
 *
 * Efeitos de domínio (ex: creditar carteira) são orquestrados através de
 * serviços de domínio (lib/wallet/wallet.service.ts)
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
import * as walletService from '@/lib/wallet/wallet.service';

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
 * IMPORTANTE: Este módulo NÃO mexe diretamente em Wallet/WalletTransaction.
 * Todos os efeitos de domínio são orquestrados através de serviços dedicados.
 *
 * Efeitos possíveis:
 * - wallet_topup: Creditar saldo na carteira (via walletService)
 * - checkout_payment: Marcar envios como pagos (TODO: implementar)
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
 * Credita saldo na carteira do usuário via wallet service
 *
 * LINHA DE CORTE: Este módulo apenas orquestra a chamada ao wallet service.
 * Toda a lógica de negócio da carteira está em lib/wallet/wallet.service.ts
 */
async function applyWalletTopup(transaction: PaymentTransaction): Promise<void> {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  const userId = transaction.userId || (metadata?.userId as string | undefined);

  if (!userId) {
    console.error('[MERCADO_PAGO] Wallet topup sem userId:', transaction.id);
    return;
  }

  try {
    // Chamar wallet service para aplicar crédito
    await walletService.creditFromGatewayTopup({
      userId,
      amountCents: transaction.amountCents,
      paymentTransactionId: transaction.id,
      currency: 'BRL',
      providerPaymentId: transaction.externalId || undefined,
    });

    // Log sem expor valores financeiros em produção
    console.log('[MERCADO_PAGO] Wallet topup orquestrado com sucesso:', {
      transactionId: transaction.id,
      ...(process.env.NODE_ENV === 'development' && {
        userId,
        amountCents: transaction.amountCents,
      }),
    });
  } catch (error) {
    // Se for erro de idempotência (já aplicado), não logar como erro
    if (error instanceof Error && error.message.includes('já aplicado')) {
      console.log('[MERCADO_PAGO] Topup já aplicado (idempotência):', transaction.id);
    } else {
      throw error;
    }
  }
}

/**
 * Marca envios como pagos e emite etiquetas
 *
 * Suporta:
 * - Pagamento único (metadata.shipmentId)
 * - Pagamento em lote (metadata.shipmentIds[])
 *
 * Operações:
 * 1. Atualiza Shipment.paymentMethod
 * 2. Atualiza Shipment.document.payment com status approved
 * 3. Emite Label associada (status issued + PDF mock)
 * 4. Idempotente: verifica se já foi aplicado antes de processar
 */
async function applyCheckoutPayment(transaction: PaymentTransaction): Promise<void> {
  const metadata = transaction.metadata as Record<string, unknown> | null;

  // Determinar shipments a processar (single ou batch)
  const singleShipmentId = metadata?.shipmentId as string | undefined;
  const batchShipmentIds = metadata?.shipmentIds as string[] | undefined;

  const shipmentIds = singleShipmentId
    ? [singleShipmentId]
    : batchShipmentIds || [];

  if (shipmentIds.length === 0) {
    console.error('[MERCADO_PAGO] Checkout payment sem shipmentId(s):', transaction.id);
    return;
  }

  try {
    // Buscar shipments a atualizar
    const shipments = await prisma.shipment.findMany({
      where: {
        id: { in: shipmentIds },
      },
      select: {
        id: true,
        paymentMethod: true,
        document: true,
        senderId: true,
      },
    });

    if (shipments.length === 0) {
      console.error('[MERCADO_PAGO] Nenhum shipment encontrado:', shipmentIds);
      return;
    }

    // Verificar idempotência: se todos já foram pagos, retornar
    const alreadyPaid = shipments.every(s => s.paymentMethod === 'MERCADO_PAGO');
    if (alreadyPaid) {
      console.log('[MERCADO_PAGO] Checkout payment já aplicado (idempotência):', transaction.id);
      return;
    }

    // PDF mock para etiquetas (420 bytes)
    const mockPdfBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvVGltZXMtUm9tYW4+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNDQ+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEV0aXF1ZXRhIFRlc3RlKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0NSAwMDAwMCBuIAowMDAwMDAwMzI4IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDIwCiUlRU9GCg==';

    // Processar cada shipment em transação atômica
    await prisma.$transaction(async (tx) => {
      for (const ship of shipments) {
        // Pular se já está pago
        if (ship.paymentMethod === 'MERCADO_PAGO') {
          continue;
        }

        const currentDoc = (ship.document as Record<string, unknown>) || {};

        // 1. Atualizar shipment com método de pagamento e confirmação
        await tx.shipment.update({
          where: { id: ship.id },
          data: {
            paymentMethod: 'MERCADO_PAGO',
            document: {
              ...currentDoc,
              payment: {
                status: 'approved',
                method: 'mercadopago',
                confirmedAt: new Date().toISOString(),
                paymentTransactionId: transaction.id,
                externalId: transaction.externalId,
                amount: transaction.amountCents / 100,
              },
            },
          },
        });

        // 2. Buscar e atualizar Label associada
        const label = await tx.label.findUnique({
          where: { shipmentId: ship.id },
        });

        if (label && label.status !== 'issued') {
          await tx.label.update({
            where: { id: label.id },
            data: {
              status: 'issued',
              fileBase64: mockPdfBase64,
              contentType: 'application/pdf',
              sizeBytes: 420,
            },
          });
        }
      }
    });

    // Log sem expor IDs de shipments em produção (apenas contagem)
    console.log('[MERCADO_PAGO] Checkout payment aplicado com sucesso:', {
      transactionId: transaction.id,
      shipmentsCount: shipments.length,
      ...(process.env.NODE_ENV === 'development' && {
        shipmentIds: shipments.map(s => s.id),
      }),
    });
  } catch (error) {
    console.error('[MERCADO_PAGO] Erro ao aplicar checkout payment:', error);
    throw error;
  }
}
