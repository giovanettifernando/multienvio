import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { Prisma } from '@prisma/client';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { ShipmentStatus, FINAL_STATUSES } from '@/modules/shipments/application/shipment-status';
import { canBeCancelled, getNextCancellationStatus } from '@/modules/shipments/application/status-migration';
import { refund as walletRefund, reaisToCents } from '@/modules/wallet/application/wallet.service';
import { cancelarPrePostagem } from '@/platform/integrations/correios';
import { logger } from '@/platform/logging/logger';

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

// Tipo para resultado de cancelamento de pré-postagem
interface CorreiosCancelResult {
  packageId: string;
  packageNumber: number;
  prePostageId: string;
  success: boolean;
  message?: string;
  attemptedAt: string;
}

/**
 * POST /api/shipments/[id]/cancel
 * Cancela um shipment seguindo as regras do novo modelo de status
 *
 * FLUXO CORRIGIDO (DB-First para garantir consistência):
 * 1. Validações (auth, ownership, status)
 * 2. TRANSAÇÃO DB: Marca cancelamento + guarda dados para cleanup
 * 3. CORREIOS API: Cancela pré-postagens (fora da transação)
 * 4. CLEANUP DB: Remove label e limpa IDs dos packages
 * 5. REEMBOLSO: Credita carteira se aplicável
 *
 * Vantagens:
 * - Se DB falhar na fase 2, Correios não é afetado
 * - Se Correios falhar na fase 3, DB já está marcado como cancelado
 * - Cleanup na fase 4 é idempotente e pode ser retentado
 */
export const POST = withApiHandler<ShipmentCancelResponse, { id: string }>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  const id = context.params.id;

  // ============================================================================
  // FASE 1: Validações
  // ============================================================================

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

  // Guardar dados da etiqueta ANTES de qualquer modificação
  const labelPriceCents = shipment.label?.priceCents || 0;
  const labelTrackingCode = shipment.label?.trackingCode || null;
  const labelId = shipment.label?.id || null;

  // IDs das pré-postagens para cancelar depois
  const packagesToCancel = shipment.packages
    ?.filter(pkg => pkg.carrierPrePostageId)
    .map(pkg => ({
      packageId: pkg.id,
      packageNumber: pkg.packageNumber,
      prePostageId: pkg.carrierPrePostageId!,
    })) || [];

  // ============================================================================
  // FASE 2: Transação DB - Marca cancelamento (SEM deletar label ainda)
  // ============================================================================

  logger.info({
    event: 'shipment_cancel_phase2_start',
    shipmentId: id,
    currentStatus,
    nextStatus: nextCancellationStatus,
    packagesToCancel: packagesToCancel.length,
  }, 'Starting cancellation - Phase 2: DB transaction');

  await prisma.$transaction(async (tx) => {
    // Atualizar status do shipment para cancelamento
    await tx.shipment.update({
      where: { id },
      data: {
        status: nextCancellationStatus,
        // Guardar metadados do cancelamento no document
        document: {
          ...(shipment.document as Record<string, unknown> || {}),
          cancellation: {
            requestedAt: new Date().toISOString(),
            previousStatus: currentStatus,
            packagesToCancel: packagesToCancel.map(p => p.prePostageId),
          },
        } as Prisma.InputJsonValue,
      },
    });

    // Cancelar pickup request se pendente/agendado
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

  logger.info({
    event: 'shipment_cancel_phase2_complete',
    shipmentId: id,
  }, 'Phase 2 complete: Shipment marked as cancelled');

  // ============================================================================
  // FASE 3: Cancelar pré-postagens nos Correios (fora da transação DB)
  // ============================================================================

  const correiosCancelResults: CorreiosCancelResult[] = [];

  if (packagesToCancel.length > 0) {
    logger.info({
      event: 'shipment_cancel_phase3_start',
      shipmentId: id,
      packagesCount: packagesToCancel.length,
    }, 'Starting cancellation - Phase 3: Correios API');

    for (const pkg of packagesToCancel) {
      try {
        const result = await cancelarPrePostagem(pkg.prePostageId);
        correiosCancelResults.push({
          packageId: pkg.packageId,
          packageNumber: pkg.packageNumber,
          prePostageId: pkg.prePostageId,
          success: result.success,
          message: result.success ? result.message : result.erro,
          attemptedAt: new Date().toISOString(),
        });

        logger.info({
          event: 'shipment_cancel_correios_result',
          packageId: pkg.packageId,
          packageNumber: pkg.packageNumber,
          prePostageId: pkg.prePostageId,
          success: result.success,
        }, result.success ? 'Pre-postagem canceled in Correios' : 'Pre-postagem cancel failed in Correios');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        correiosCancelResults.push({
          packageId: pkg.packageId,
          packageNumber: pkg.packageNumber,
          prePostageId: pkg.prePostageId,
          success: false,
          message: errorMessage,
          attemptedAt: new Date().toISOString(),
        });

        logger.error({
          event: 'shipment_cancel_correios_error',
          packageId: pkg.packageId,
          prePostageId: pkg.prePostageId,
          err: error,
        }, 'Unexpected error canceling pre-postagem in Correios');
      }
    }

    logger.info({
      event: 'shipment_cancel_phase3_complete',
      shipmentId: id,
      total: correiosCancelResults.length,
      successful: correiosCancelResults.filter(r => r.success).length,
      failed: correiosCancelResults.filter(r => !r.success).length,
    }, 'Phase 3 complete: Correios API calls finished');
  }

  // ============================================================================
  // FASE 4: Cleanup - Deletar label e limpar IDs dos packages
  // ============================================================================

  logger.info({
    event: 'shipment_cancel_phase4_start',
    shipmentId: id,
  }, 'Starting cancellation - Phase 4: Cleanup');

  try {
    await prisma.$transaction(async (tx) => {
      // Deletar label
      if (labelId) {
        await tx.label.delete({
          where: { id: labelId },
        });
      }

      // Limpar dados de carrier dos packages
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
      }

      // Limpar código de rastreio e atualizar document com resultados
      await tx.shipment.update({
        where: { id },
        data: {
          carrierTrackingCode: null,
          document: {
            ...(shipment.document as Record<string, unknown> || {}),
            cancellation: {
              requestedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              previousStatus: currentStatus,
              correiosResults: correiosCancelResults as unknown as Prisma.JsonArray,
            },
          } as Prisma.InputJsonValue,
        },
      });
    });

    logger.info({
      event: 'shipment_cancel_phase4_complete',
      shipmentId: id,
    }, 'Phase 4 complete: Cleanup finished');
  } catch (cleanupError) {
    // Cleanup falhou, mas o cancelamento principal já foi feito
    // Logar erro mas não falhar a requisição
    logger.error({
      event: 'shipment_cancel_cleanup_error',
      shipmentId: id,
      err: cleanupError,
    }, 'Cleanup failed but cancellation was successful - may need manual cleanup');
  }

  // ============================================================================
  // FASE 5: Reembolso (se aplicável)
  // ============================================================================

  let refundIssued = false;
  let refundAmount = 0;

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
      logger.error({
        event: 'shipment_cancel_refund_error',
        shipmentId: shipment.id,
        err: refundError,
      }, 'Error issuing refund - may need manual intervention');
    }
  }

  // ============================================================================
  // Resposta
  // ============================================================================

  let message = nextCancellationStatus === ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF
    ? 'Envio cancelado com sucesso'
    : 'Solicitação de cancelamento registrada. A transportadora será notificada.';

  if (refundIssued) {
    message += `. Reembolso de R$ ${refundAmount.toFixed(2)} creditado na carteira.`;
  }

  // Adicionar aviso se algum cancelamento no Correios falhou
  const failedCorreios = correiosCancelResults.filter(r => !r.success);
  if (failedCorreios.length > 0) {
    logger.warn({
      event: 'shipment_cancel_correios_partial_failure',
      shipmentId: id,
      failedCount: failedCorreios.length,
      failed: failedCorreios,
    }, 'Some Correios cancellations failed');
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
