/**
 * API Admin - Sincronizar Agências dos Correios
 *
 * POST /api/admin/correios-agencies/sync
 * Enfileira sincronização de agências via BullMQ (um job por UF).
 * Retorna 202 imediatamente — o worker processa em background.
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { AdminPermission } from '@prisma/client';
import { getQueue, QUEUE_NAMES, type CorreiosAgenciesSyncJobPayload } from '@/platform/queue';

// UFs do Brasil para sincronização
const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

interface CorreiosAgencySyncResponse {
  message: string;
  ufsEnqueued: number;
  ufs: string[];
  clearBefore: boolean;
}

export const POST = withApiHandler<CorreiosAgencySyncResponse>(async (context) => {
  const { req } = context;

  const session = await requireAdminSession(req, AdminPermission.OPERACOES);

  if (!session.permissions.includes(AdminPermission.CONFIGURACOES)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  // Parâmetros opcionais
  const body = await req.json().catch(() => ({}));
  const ufsToSync = body.ufs as string[] | undefined;
  const clearBefore = body.clearBefore as boolean | undefined;

  const targetUfs = ufsToSync && ufsToSync.length > 0 ? ufsToSync : UFS_BRASIL;

  // Opcional: limpar antes de sincronizar
  if (clearBefore) {
    await prisma.correiosAgency.deleteMany({
      where: targetUfs.length < UFS_BRASIL.length ? { uf: { in: targetUfs } } : undefined,
    });
  }

  // Enfileirar um job por UF
  const queue = getQueue<CorreiosAgenciesSyncJobPayload>(QUEUE_NAMES.CORREIOS_AGENCIES_SYNC);

  const jobs = targetUfs.map((uf) => ({
    name: `sync-uf-${uf}`,
    data: {
      uf,
      clearBefore: false, // Já limpamos acima se necessário
    },
    opts: {
      jobId: `correios-agencies-${uf}-${Date.now()}`,
    },
  }));

  await queue.addBulk(jobs);

  return {
    status: 202,
    data: {
      message: `Sincronização enfileirada para ${targetUfs.length} UF(s)`,
      ufsEnqueued: targetUfs.length,
      ufs: targetUfs,
      clearBefore: !!clearBefore,
    },
  };
});
