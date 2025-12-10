import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getUserFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { WalletDebitApiSchema } from '@/lib/validation/wallet';
import { logger } from '@/lib/logger';

/**
 * Resposta da API de débito da carteira
 */
export interface WalletDebitResponse {
  ok: boolean;
  idempotent: boolean;
  balance: number;
  transactionId: string;
  message?: string;
}

/**
 * POST /api/wallet/debit
 * Debita valor da carteira para pagamento de envio (idempotente por referenceId)
 */
export const POST = withApiHandler<WalletDebitResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  const body = await context.req.json();

  // Validação com Zod
  const validation = WalletDebitApiSchema.safeParse(body);
  if (!validation.success) {
    logger.debug({ event: 'wallet_debit_validation_error', errors: validation.error.flatten() }, 'Validation failed');
    throw new ApiError({
      code: 'validation_error',
      message: validation.error.issues[0]?.message || 'Dados inválidos',
      status: 400,
    });
  }

  const { shipmentId, referenceId: customReferenceId, amount, reason, trackingCode, metadata } = validation.data;

  const amountCents = Math.round(amount * 100);
  const referenceId = customReferenceId || `shipment:${shipmentId}`;

  // Verificar se o shipment existe
  if (shipmentId) {
    const existingShipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!existingShipment) {
      throw new ApiError({ code: 'not_found', message: 'Envio não encontrado', status: 404 });
    }
  }

  // Realizar débito em transação atômica e idempotente
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Verificar idempotência
      const existingTransaction = await tx.walletTransaction.findUnique({
        where: { referenceId },
      });

      if (existingTransaction) {
        const wallet = await tx.wallet.findUnique({
          where: { userId: session.userId },
        });
        return {
          ok: true,
          idempotent: true,
          balance: wallet ? wallet.availableCents / 100 : 0,
          transactionId: existingTransaction.id,
        };
      }

      // 2) Buscar carteira COM LOCK
      const wallets = await tx.$queryRaw<Array<{ id: string; userId: string; availableCents: number; pendingCents: number }>>`
        SELECT id, "userId", "availableCents", "pendingCents"
        FROM "wallets"
        WHERE "userId" = ${session.userId}
        FOR UPDATE
      `;

      const wallet = wallets[0];

      if (!wallet) {
        throw Object.assign(new Error('Carteira não encontrada'), { code: 'WALLET_NOT_FOUND' });
      }

      // 3) Verificar saldo
      if (wallet.availableCents < amountCents) {
        throw Object.assign(new Error('Saldo insuficiente na carteira'), { code: 'INSUFFICIENT_FUNDS' });
      }

      // 4) Debitar carteira
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableCents: { decrement: amountCents },
        },
      });

      // 5) Criar transação na carteira
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PURCHASE',
          amountCents,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          title: trackingCode
            ? `Pagamento envio ${trackingCode}`
            : shipmentId
            ? `Pagamento envio ${shipmentId}`
            : `Pagamento - ${reason || 'compra'}`,
          referenceId,
          meta: {
            ...(shipmentId && { shipmentId }),
            ...(trackingCode && { trackingCode }),
            reason: reason || 'shipment_payment',
            ...(metadata && metadata),
          },
        },
      });

      // 6) Criar entrada no ledger
      await tx.ledgerEntry.create({
        data: {
          type: 'CHARGE',
          amountCents,
          accountType: 'WALLET',
          accountId: wallet.id,
          description: trackingCode
            ? `Pagamento envio ${trackingCode}`
            : shipmentId
            ? `Pagamento envio ${shipmentId}`
            : `Pagamento - ${reason || 'compra'}`,
          metadata: {
            ...(shipmentId && { shipmentId }),
            ...(trackingCode && { trackingCode }),
            userId: session.userId,
            walletTransactionId: transaction.id,
            ...(metadata && metadata),
          },
        },
      });

      // 7) Atualizar shipments e emitir etiquetas
      const shipmentIdsToUpdate = shipmentId
        ? [shipmentId]
        : (metadata && Array.isArray(metadata.shipmentIds))
        ? metadata.shipmentIds
        : [];

      if (shipmentIdsToUpdate.length > 0) {
        const shipmentsToUpdate = await tx.shipment.findMany({
          where: {
            id: { in: shipmentIdsToUpdate },
            senderId: session.userId,
          },
          select: {
            id: true,
            document: true,
          },
        });

        // OTIMIZAÇÃO N+1: Buscar todas as labels de uma vez
        const shipmentIds = shipmentsToUpdate.map(s => s.id);
        const existingLabels = await tx.label.findMany({
          where: { shipmentId: { in: shipmentIds } },
          select: { id: true, shipmentId: true },
        });
        const labelsByShipmentId = new Map(existingLabels.map(l => [l.shipmentId, l.id]));

        // OTIMIZAÇÃO N+1: Atualizar todos os shipments em batch
        await Promise.all(shipmentsToUpdate.map(ship => {
          const currentDoc = (ship.document as Record<string, unknown>) || {};
          return tx.shipment.update({
            where: { id: ship.id },
            data: {
              paymentMethod: 'WALLET',
              document: {
                ...currentDoc,
                payment: {
                  status: 'approved',
                  method: 'wallet',
                  confirmedAt: new Date().toISOString(),
                  walletTransactionId: transaction.id,
                  amount,
                },
              },
            },
          });
        }));

        // OTIMIZAÇÃO N+1: Atualizar todas as labels existentes em batch
        // Nota: O PDF real é baixado on-demand via /api/labels/[id]/pdf (usa API Correios)
        // Aqui apenas marcamos a label como emitida
        const labelIdsToUpdate = existingLabels.map(l => l.id);
        if (labelIdsToUpdate.length > 0) {
          await tx.label.updateMany({
            where: { id: { in: labelIdsToUpdate } },
            data: {
              status: 'issued',
            },
          });
        }

        // 8) Marcar carrinho como CHECKED_OUT
        const cart = await tx.cart.findFirst({
          where: {
            userId: session.userId,
            status: 'LOCKED',
          },
        });

        if (cart && cart.meta) {
          const cartMeta = cart.meta as { shipmentIds?: string[]; [key: string]: unknown };
          const hasMatchingShipments = shipmentIdsToUpdate.some(
            (id: string) => cartMeta.shipmentIds?.includes(id)
          );

          if (hasMatchingShipments) {
            const allCartShipments = await tx.shipment.findMany({
              where: {
                id: { in: cartMeta.shipmentIds || [] },
              },
            });

            const allPaid = allCartShipments.every(
              (s) => s.paymentMethod !== null
            );

            if (allPaid) {
              await tx.cartItem.deleteMany({
                where: { cartId: cart.id },
              });

              await tx.cart.update({
                where: { id: cart.id },
                data: {
                  status: 'CHECKED_OUT',
                  updatedAt: new Date(),
                },
              });
            }
          }
        }
      }

      return {
        ok: true,
        idempotent: false,
        balance: updatedWallet.availableCents / 100,
        transactionId: transaction.id,
      };
    });

    return {
      data: {
        ok: result.ok,
        idempotent: result.idempotent,
        balance: result.balance,
        transactionId: result.transactionId,
        ...(result.idempotent && {
          message: 'Pagamento já processado anteriormente'
        }),
      },
    };

  } catch (txError) {
    // Tratamento especial para P2002 (unique constraint violation)
    if (txError instanceof Error && 'code' in txError && (txError as { code: string }).code === 'P2002') {
      const existingTransaction = await prisma.walletTransaction.findUnique({
        where: { referenceId },
      });

      if (existingTransaction) {
        const wallet = await prisma.wallet.findUnique({
          where: { userId: session.userId },
        });

        return {
          data: {
            ok: true,
            idempotent: true,
            balance: wallet ? wallet.availableCents / 100 : 0,
            transactionId: existingTransaction.id,
            message: 'Pagamento já processado anteriormente',
          },
        };
      }
    }

    logger.error({ event: 'wallet_debit_error', err: txError }, 'Wallet debit failed');

    // Saldo insuficiente
    if (txError instanceof Error && 'code' in txError && (txError as { code: string }).code === 'INSUFFICIENT_FUNDS') {
      throw new ApiError({
        code: 'insufficient_funds',
        message: 'Saldo insuficiente na carteira',
        status: 400,
      });
    }

    throw new ApiError({
      code: 'debit_error',
      message: 'Erro ao processar débito',
      status: 500,
    });
  }
});
