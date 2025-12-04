
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * POST /api/wallet/debit
 * Debita valor da carteira para pagamento de envio (idempotente por referenceId)
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { shipmentId, referenceId: customReferenceId, amount, reason, trackingCode, metadata } = body;

    // Aceita tanto shipmentId (legado) quanto referenceId (novo)
    if ((!shipmentId && !customReferenceId) || !amount || amount <= 0) {
      return NextResponse.json(
        { message: 'Dados inválidos' },
        { status: 400 }
      );
    }

    const amountCents = Math.round(amount * 100);

    // referenceId estável para garantir idempotência
    const referenceId = customReferenceId || `shipment:${shipmentId}`;

    // Verificar se o shipment existe (apenas se shipmentId foi fornecido)
    if (shipmentId) {
      const existingShipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
      });

      if (!existingShipment) {
        return NextResponse.json(
          { message: 'Envio não encontrado' },
          { status: 404 }
        );
      }
    }

    // Realizar débito em transação atômica e idempotente
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1) Verificar se já existe transação com este referenceId (idempotência)
        const existingTransaction = await tx.walletTransaction.findUnique({
          where: { referenceId },
        });

        if (existingTransaction) {
          // Já foi processado - retornar sucesso idempotente
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

        // 2) Buscar carteira COM LOCK (SELECT FOR UPDATE para prevenir race condition)
        const wallets = await tx.$queryRaw<Array<{ id: string; userId: string; availableCents: number; pendingCents: number }>>`
          SELECT id, "userId", "availableCents", "pendingCents"
          FROM "wallets"
          WHERE "userId" = ${session.userId}
          FOR UPDATE
        `;

        const wallet = wallets[0];

        if (!wallet) {
          throw Object.assign(new Error('Carteira não encontrada'), {
            code: 'WALLET_NOT_FOUND'
          });
        }

        // 3) Verificar saldo (com row já bloqueada, garantindo consistência)
        if (wallet.availableCents < amountCents) {
          throw Object.assign(new Error('Saldo insuficiente na carteira'), {
            code: 'INSUFFICIENT_FUNDS'
          });
        }

        // 4) Debitar carteira (row já está bloqueada pelo FOR UPDATE)
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableCents: { decrement: amountCents },
          },
        });

        // 5) Criar transação na carteira (único por referenceId)
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
            referenceId, // UNIQUE - garante idempotência
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

        // 7) Se for pagamento de shipment, registrar método de pagamento e emitir etiqueta
        // Determinar quais shipments atualizar (single ou batch via metadata)
        const shipmentIdsToUpdate = shipmentId
          ? [shipmentId]
          : (metadata && Array.isArray(metadata.shipmentIds))
          ? metadata.shipmentIds
          : [];

        if (shipmentIdsToUpdate.length > 0) {
          // Buscar todos os shipments para atualizar
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

          // Atualizar cada shipment COM CONFIRMAÇÃO DE PAGAMENTO (transação atômica)
          const mockPdfBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvVGltZXMtUm9tYW4+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNDQ+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEV0aXF1ZXRhIFRlc3RlKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0NSAwMDAwMCBuIAowMDAwMDAwMzI4IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDIwCiUlRU9GCg==';

          for (const ship of shipmentsToUpdate) {
            const currentDoc = (ship.document as Record<string, unknown>) || {};

            // Atualizar shipment com método de pagamento E confirmação no document
            await tx.shipment.update({
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

            // Buscar e atualizar a label associada
            const label = await tx.label.findUnique({
              where: { shipmentId: ship.id },
            });

            if (label) {
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

          // 8) Marcar carrinho como CHECKED_OUT e remover itens
          // Buscar carrinho LOCKED que contém estes shipments
          const cart = await tx.cart.findFirst({
            where: {
              userId: session.userId,
              status: 'LOCKED',
            },
          });

          if (cart && cart.meta) {
            const cartMeta = cart.meta as { shipmentIds?: string[]; [key: string]: unknown };
            // Verificar se o carrinho contém os shipments pagos
            const hasMatchingShipments = shipmentIdsToUpdate.some(
              (id: string) => cartMeta.shipmentIds?.includes(id)
            );

            if (hasMatchingShipments) {
              // Verificar se todos os shipments do carrinho foram pagos
              const allCartShipments = await tx.shipment.findMany({
                where: {
                  id: { in: cartMeta.shipmentIds || [] },
                },
              });

              const allPaid = allCartShipments.every(
                (s) => s.paymentMethod !== null
              );

              if (allPaid) {
                // Remover itens do carrinho
                await tx.cartItem.deleteMany({
                  where: { cartId: cart.id },
                });

                // Marcar carrinho como CHECKED_OUT
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

      return NextResponse.json({
        ok: result.ok,
        idempotent: result.idempotent,
        balance: result.balance,
        transactionId: result.transactionId,
        ...(result.idempotent && {
          message: 'Pagamento já processado anteriormente'
        }),
      });

    } catch (txError) {
      // Tratamento especial para P2002 (unique constraint violation)
      if (txError instanceof Error && 'code' in txError && (txError as { code: string }).code === 'P2002') {
        // Buscar a transação existente e retornar sucesso idempotente
        const existingTransaction = await prisma.walletTransaction.findUnique({
          where: { referenceId },
        });

        if (existingTransaction) {
          const wallet = await prisma.wallet.findUnique({
            where: { userId: session.userId },
          });

          return NextResponse.json({
            ok: true,
            idempotent: true,
            balance: wallet ? wallet.availableCents / 100 : 0,
            transactionId: existingTransaction.id,
            message: 'Pagamento já processado anteriormente',
          });
        }
      }

      // Re-throw para o catch externo tratar
      throw txError;
    }

  } catch (error) {
    console.error('[WALLET_DEBIT]', error);

    // Saldo insuficiente
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json(
        {
          ok: false,
          code: 'INSUFFICIENT_FUNDS',
          message: 'Saldo insuficiente na carteira'
        },
        { status: 400 }
      );
    }

    // Erro genérico
    return NextResponse.json(
      {
        ok: false,
        message: 'Erro ao processar débito'
      },
      { status: 500 }
    );
  }
}
