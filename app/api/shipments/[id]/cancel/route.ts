import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth/session';
import { ShipmentStatus, FINAL_STATUSES } from '@/lib/shipments/shipment-status';
import { canBeCancelled, getNextCancellationStatus } from '@/lib/shipments/status-migration';
import { refund as walletRefund, reaisToCents } from '@/lib/wallet/wallet.service';
import { cancelarPrePostagem } from '@/lib/integrations/correios';
import { logger } from '@/lib/logger';

type ShipmentCancelResponseWithRefund = {
  ok: true;
  message: string;
  newStatus: ShipmentStatus;
  refund: {
    amount: number;
    credited: true;
  };
};

type ShipmentCancelResponseWithoutRefund = {
  ok: true;
  message: string;
  newStatus: ShipmentStatus;
};

type ShipmentCancelResponse = ShipmentCancelResponseWithRefund | ShipmentCancelResponseWithoutRefund;

/**
 * POST /api/shipments/[id]/cancel
 * Cancela um shipment seguindo as regras do novo modelo de status
 */
export const POST = withApiHandler<ShipmentCancelResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const id = context.params.id;

  // Verificar se o shipment pertence ao usuário
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      label: true,
      pickupRequest: true,
      packages: true,
    },
  });

  if (!shipment) {
    throw new ApiError({ code: 'not_found', message: 'Envio não encontrado', status: 404 });
  }

  if (shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  const currentStatus = shipment.status as ShipmentStatus;

  // Verificar se está em status final
  if ((FINAL_STATUSES as readonly ShipmentStatus[]).includes(currentStatus)) {
    throw new ApiError({
      code: 'already_finalized',
      message: 'Este envio já está finalizado e não pode ser cancelado',
      status: 400,
    });
  }

  // Verificar se pode ser cancelado
  if (!canBeCancelled(currentStatus)) {
    throw new ApiError({
      code: 'cannot_cancel',
      message: 'Não é possível cancelar este envio no status atual',
      status: 400,
    });
  }

  // Determinar próximo status de cancelamento
  const nextCancellationStatus = getNextCancellationStatus(currentStatus);

  if (!nextCancellationStatus) {
    throw new ApiError({
      code: 'cancel_status_error',
      message: 'Erro ao determinar status de cancelamento',
      status: 500,
    });
  }

  // Verificar se houve pagamento via carteira para reembolso
  let refundIssued = false;
  let refundAmount = 0;

  // Salvar dados da etiqueta ANTES de deletar
  const labelPriceCents = shipment.label?.priceCents || 0;
  const labelTrackingCode = shipment.label?.trackingCode || null;

  // Cancelar pré-postagens nos Correios
  const correiosCancelResults: Array<{
    packageId: string;
    packageNumber: number;
    prePostageId: string;
    success: boolean;
    message?: string;
  }> = [];

  if (shipment.packages && shipment.packages.length > 0) {
    logger.info({
      event: 'shipment_cancel_prepostagem_start',
      shipmentId: id,
      packagesCount: shipment.packages.length,
    }, 'Canceling pre-postagens for packages');

    for (const pkg of shipment.packages) {
      if (pkg.carrierPrePostageId) {
        try {
          const result = await cancelarPrePostagem(pkg.carrierPrePostageId);
          correiosCancelResults.push({
            packageId: pkg.id,
            packageNumber: pkg.packageNumber,
            prePostageId: pkg.carrierPrePostageId,
            success: result.success,
            message: result.success ? result.message : result.erro,
          });

          logger.info({
            event: 'shipment_cancel_prepostagem_result',
            packageId: pkg.id,
            packageNumber: pkg.packageNumber,
            prePostageId: pkg.carrierPrePostageId,
            success: result.success,
          }, result.success ? 'Pre-postagem canceled' : 'Pre-postagem cancel failed');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          correiosCancelResults.push({
            packageId: pkg.id,
            packageNumber: pkg.packageNumber,
            prePostageId: pkg.carrierPrePostageId,
            success: false,
            message: errorMessage,
          });

          logger.error({
            event: 'shipment_cancel_prepostagem_error',
            packageId: pkg.id,
            prePostageId: pkg.carrierPrePostageId,
            err: error,
          }, 'Unexpected error canceling pre-postagem');
        }
      }
    }

    logger.info({
      event: 'shipment_cancel_prepostagem_summary',
      shipmentId: id,
      total: correiosCancelResults.length,
      successful: correiosCancelResults.filter(r => r.success).length,
      failed: correiosCancelResults.filter(r => !r.success).length,
    }, 'Pre-postagem cancellation summary');
  }

  // Cancelar shipment, label, packages e pickup em transação
  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id },
      data: { status: nextCancellationStatus },
    });

    if (shipment.label) {
      await tx.label.delete({
        where: { id: shipment.label.id },
      });
    }

    if (shipment.packages && shipment.packages.length > 0) {
      for (const pkg of shipment.packages) {
        if (pkg.carrierPrePostageId || pkg.carrierTrackingCode) {
          await tx.package.update({
            where: { id: pkg.id },
            data: {
              carrierPrePostageId: null,
              carrierTrackingCode: null,
              carrierQuotePrice: null,
            },
          });
        }
      }

      await tx.shipment.update({
        where: { id },
        data: { carrierTrackingCode: null },
      });
    }

    if (shipment.pickupRequest) {
      const pickupStatus = shipment.pickupRequest.status;
      if (pickupStatus === 'PENDING' || pickupStatus === 'SCHEDULED') {
        await tx.pickupRequest.update({
          where: { id: shipment.pickupRequest.id },
          data: { status: 'CANCELED' },
        });
      }
    }
  });

  // REEMBOLSO se pagamento via carteira
  if (
    shipment.paymentMethod === 'WALLET' &&
    nextCancellationStatus === ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF
  ) {
    try {
      const doc = shipment.document as Record<string, unknown> | null;
      const paymentInfo = doc?.payment as { amount?: number } | undefined;
      const labelPriceReais = labelPriceCents ? labelPriceCents / 100 : 0;
      const amountToRefund = paymentInfo?.amount || labelPriceReais || shipment.freightCost || 0;

      if (amountToRefund > 0) {
        const refundReferenceId = `refund:shipment:${shipment.id}`;

        await walletRefund(
          session.userId,
          reaisToCents(amountToRefund),
          `Reembolso - Cancelamento envio ${labelTrackingCode || shipment.id}`,
          refundReferenceId
        );

        refundIssued = true;
        refundAmount = amountToRefund;

        logger.info({
          event: 'shipment_cancel_refund_issued',
          shipmentId: shipment.id,
          userId: session.userId,
          amount: amountToRefund,
        }, 'Refund issued');
      }
    } catch (refundError) {
      logger.error({ event: 'shipment_cancel_refund_error', shipmentId: shipment.id, err: refundError }, 'Error issuing refund');
    }
  }

  let message = nextCancellationStatus === ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF
    ? 'Envio cancelado com sucesso'
    : 'Solicitação de cancelamento registrada. A transportadora será notificada.';

  if (refundIssued) {
    message += `. Reembolso de R$ ${refundAmount.toFixed(2)} creditado na carteira.`;
  }

  return {
    data: {
      ok: true,
      message,
      newStatus: nextCancellationStatus,
      ...(refundIssued && { refund: { amount: refundAmount, credited: true } }),
    },
  };
});
