export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

        // 2) Buscar carteira
        const wallet = await tx.wallet.findUnique({
          where: { userId: session.userId },
        });

        if (!wallet) {
          throw Object.assign(new Error('Carteira não encontrada'), {
            code: 'WALLET_NOT_FOUND'
          });
        }

        // 3) Verificar saldo
        if (wallet.availableCents < amountCents) {
          throw Object.assign(new Error('Saldo insuficiente na carteira'), {
            code: 'INSUFFICIENT_FUNDS'
          });
        }

        // 4) Debitar carteira
        const updatedWallet = await tx.wallet.update({
          where: { userId: session.userId },
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
