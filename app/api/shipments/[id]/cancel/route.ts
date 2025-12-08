
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from '@/lib/auth/session';
import { ShipmentStatus, FINAL_STATUSES } from "@/lib/shipments/shipment-status";
import { canBeCancelled, getNextCancellationStatus } from "@/lib/shipments/status-migration";
import { refund as walletRefund, reaisToCents } from "@/lib/wallet/wallet.service";
import { cancelarPrePostagem } from "@/lib/integrations/correios";

/**
 * POST /api/shipments/[id]/cancel
 * Cancela um shipment seguindo as regras do novo modelo de status
 * - Se ainda não foi entregue à transportadora: CANCELLED_BEFORE_HANDOFF
 * - Se já está em trânsito: CANCELLATION_REQUESTED_IN_TRANSIT
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Autenticar usuário
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

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
      return NextResponse.json({ message: "Envio não encontrado" }, { status: 404 });
    }

    if (shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const currentStatus = shipment.status as ShipmentStatus;

    // Verificar se está em status final (não pode ser cancelado)
    if ((FINAL_STATUSES as readonly ShipmentStatus[]).includes(currentStatus)) {
      return NextResponse.json(
        { message: 'Este envio já está finalizado e não pode ser cancelado' },
        { status: 400 }
      );
    }

    // Verificar se pode ser cancelado
    if (!canBeCancelled(currentStatus)) {
      return NextResponse.json(
        { message: 'Não é possível cancelar este envio no status atual' },
        { status: 400 }
      );
    }

    // Determinar próximo status de cancelamento
    const nextCancellationStatus = getNextCancellationStatus(currentStatus);

    if (!nextCancellationStatus) {
      return NextResponse.json(
        { message: 'Erro ao determinar status de cancelamento' },
        { status: 500 }
      );
    }

    // Verificar se houve pagamento via carteira para reembolso
    let refundIssued = false;
    let refundAmount = 0;

    // Salvar dados da etiqueta ANTES de deletar (para cálculo de reembolso)
    const labelPriceCents = shipment.label?.priceCents || 0;
    const labelTrackingCode = shipment.label?.trackingCode || null;

    // ==========================================
    // CANCELAR PRÉ-POSTAGENS NOS CORREIOS
    // ==========================================
    // Antes de atualizar o banco, tentar cancelar as pré-postagens de cada package nos Correios
    // Erros não bloqueiam o cancelamento do shipment (apenas logados)
    const correiosCancelResults: Array<{
      packageId: string;
      packageNumber: number;
      prePostageId: string;
      success: boolean;
      message?: string;
    }> = [];

    if (shipment.packages && shipment.packages.length > 0) {
      console.log('[SHIPMENT_CANCEL] Canceling pre-postagens for packages:', {
        shipmentId: id,
        packagesCount: shipment.packages.length,
      });

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

            console.log('[SHIPMENT_CANCEL] Pre-postagem cancel result:', {
              packageId: pkg.id,
              packageNumber: pkg.packageNumber,
              prePostageId: pkg.carrierPrePostageId,
              success: result.success,
              message: result.success ? result.message : result.erro,
            });
          } catch (error) {
            // Erro inesperado - logar mas não bloquear
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            correiosCancelResults.push({
              packageId: pkg.id,
              packageNumber: pkg.packageNumber,
              prePostageId: pkg.carrierPrePostageId,
              success: false,
              message: errorMessage,
            });

            console.error('[SHIPMENT_CANCEL] Unexpected error canceling pre-postagem:', {
              packageId: pkg.id,
              prePostageId: pkg.carrierPrePostageId,
              error: errorMessage,
            });
          }
        }
      }

      console.log('[SHIPMENT_CANCEL] Pre-postagem cancellation summary:', {
        shipmentId: id,
        total: correiosCancelResults.length,
        successful: correiosCancelResults.filter(r => r.success).length,
        failed: correiosCancelResults.filter(r => !r.success).length,
      });
    }

    // Cancelar shipment, label, packages e pickup em uma transação
    await prisma.$transaction(async (tx) => {
      // Atualizar status do shipment
      await tx.shipment.update({
        where: { id },
        data: { status: nextCancellationStatus },
      });

      // Se houver label associada, DELETAR do banco
      // (dados já salvos em labelPriceCents e labelTrackingCode para reembolso)
      if (shipment.label) {
        await tx.label.delete({
          where: { id: shipment.label.id },
        });
      }

      // Limpar dados de pré-postagem dos packages (independente do resultado do Correios)
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

        // Limpar o código de rastreio do shipment também
        await tx.shipment.update({
          where: { id },
          data: { carrierTrackingCode: null },
        });
      }

      // Se houver pickup request associado, verificar status antes de cancelar
      // Regra: apenas cancela se ainda não foi coletada (PENDING ou SCHEDULED)
      // Se já foi coletada (COLLECTED ou COMPLETED), mantém o fluxo para o coletor completar e receber a comissão
      if (shipment.pickupRequest) {
        const pickupStatus = shipment.pickupRequest.status;

        if (pickupStatus === 'PENDING' || pickupStatus === 'SCHEDULED') {
          // Cancela a pickup pois ainda não foi coletada
          await tx.pickupRequest.update({
            where: { id: shipment.pickupRequest.id },
            data: { status: 'CANCELED' },
          });
        }
        // Se status for COLLECTED ou COMPLETED, não faz nada - deixa o coletor completar o trabalho
      }
    });

    // REEMBOLSO: Se o pagamento foi via carteira (WALLET), devolver o valor
    // Apenas para cancelamentos ANTES do handoff (após, pode haver custos)
    if (
      shipment.paymentMethod === 'WALLET' &&
      nextCancellationStatus === ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF
    ) {
      try {
        // Buscar valor pago: prioridade document > label.priceCents > freightCost
        const doc = shipment.document as Record<string, unknown> | null;
        const paymentInfo = doc?.payment as { amount?: number } | undefined;
        // Se payment info não tiver amount, usar o preço da etiqueta em centavos convertido para reais
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

          console.log('[SHIPMENT_CANCEL] Reembolso emitido:', {
            shipmentId: shipment.id,
            userId: session.userId,
            amount: amountToRefund,
          });
        }
      } catch (refundError) {
        // Log do erro mas não falhar o cancelamento
        console.error('[SHIPMENT_CANCEL] Erro ao emitir reembolso:', refundError);
        // Marcar para acompanhamento manual
      }
    }

    // Mensagem baseada no tipo de cancelamento
    let message = nextCancellationStatus === ShipmentStatus.CANCELLATION_REQUESTED_BEFORE_HANDOFF
      ? 'Envio cancelado com sucesso'
      : 'Solicitação de cancelamento registrada. A transportadora será notificada.';

    if (refundIssued) {
      message += `. Reembolso de R$ ${refundAmount.toFixed(2)} creditado na carteira.`;
    }

    return NextResponse.json({
      ok: true,
      message,
      newStatus: nextCancellationStatus,
      ...(refundIssued && { refund: { amount: refundAmount, credited: true } }),
    });
  } catch (error) {
    console.error('[SHIPMENT_CANCEL]', error);
    const message = error instanceof Error ? error.message : 'Erro ao cancelar envio';
    return NextResponse.json({ message }, { status: 500 });
  }
}
