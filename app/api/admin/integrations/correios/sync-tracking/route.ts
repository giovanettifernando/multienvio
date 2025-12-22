/**
 * POST /api/admin/integrations/correios/sync-tracking
 *
 * Sincroniza eventos de rastreamento dos Correios com shipments no banco.
 * Usado quando webhooks não estão disponíveis ou para forçar atualização manual.
 */

import { z } from 'zod';
import { requireAdminUser } from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import {
  syncCorreiosTracking,
  syncCorreiosTrackingBatch,
  syncAllPendingCorreiosShipments,
} from '@/modules/tracking/application/sync-correios-tracking.service';

/**
 * Schema para sincronização
 */
const syncSchema = z.discriminatedUnion('mode', [
  // Sincronizar um código específico
  z.object({
    mode: z.literal('single'),
    trackingCode: z.string().min(1, 'Código de rastreio é obrigatório'),
  }),

  // Sincronizar múltiplos códigos
  z.object({
    mode: z.literal('batch'),
    trackingCodes: z.array(z.string()).min(1, 'Informe pelo menos um código').max(50, 'Máximo 50 códigos por vez'),
  }),

  // Sincronizar todos os pendentes
  z.object({
    mode: z.literal('all_pending'),
  }),
]);

type SyncInput = z.infer<typeof syncSchema>;

/**
 * POST - Sincroniza rastreamento dos Correios
 */
export const POST = withApiHandler<unknown>(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.INTEGRACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  // Validar payload
  const body = await req.json();
  const parsed = syncSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const data: SyncInput = parsed.data;
  const startTime = Date.now();

  switch (data.mode) {
    case 'single': {
      const result = await syncCorreiosTracking(data.trackingCode);
      const latency = Date.now() - startTime;

      return {
        data: {
          success: result.success,
          mode: 'single',
          message: result.message,
          result: {
            trackingCode: result.trackingCode,
            shipmentId: result.shipmentId,
            eventsAdded: result.eventsAdded,
            statusUpdated: result.statusUpdated,
            previousStatus: result.previousStatus,
            newStatus: result.newStatus,
            events: result.events,
          },
          latencyMs: latency,
        },
      };
    }

    case 'batch': {
      const results = await syncCorreiosTrackingBatch(data.trackingCodes);
      const latency = Date.now() - startTime;

      const successCount = results.filter((r) => r.success).length;
      const updatedCount = results.filter((r) => r.eventsAdded > 0 || r.statusUpdated).length;

      return {
        data: {
          success: successCount === results.length,
          mode: 'batch',
          message: `Sincronização em lote: ${successCount}/${results.length} sucesso, ${updatedCount} atualizados`,
          summary: {
            total: results.length,
            success: successCount,
            failed: results.length - successCount,
            updated: updatedCount,
          },
          results: results.map((r) => ({
            trackingCode: r.trackingCode,
            shipmentId: r.shipmentId,
            success: r.success,
            message: r.message,
            eventsAdded: r.eventsAdded,
            statusUpdated: r.statusUpdated,
          })),
          latencyMs: latency,
        },
      };
    }

    case 'all_pending': {
      const batchResult = await syncAllPendingCorreiosShipments();
      const latency = Date.now() - startTime;

      return {
        data: {
          success: batchResult.failed === 0,
          mode: 'all_pending',
          message: `Sincronização de pendentes: ${batchResult.synced}/${batchResult.total} atualizados`,
          summary: {
            total: batchResult.total,
            synced: batchResult.synced,
            failed: batchResult.failed,
            noChanges: batchResult.total - batchResult.synced - batchResult.failed,
          },
          results: batchResult.results.map((r) => ({
            trackingCode: r.trackingCode,
            shipmentId: r.shipmentId,
            success: r.success,
            message: r.message,
            eventsAdded: r.eventsAdded,
            statusUpdated: r.statusUpdated,
          })),
          latencyMs: latency,
        },
      };
    }

    default:
      throw new ApiError({
        code: 'INVALID_MODE',
        message: 'Modo de sincronização não suportado',
        status: 400,
      });
  }
});
