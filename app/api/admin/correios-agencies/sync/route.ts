/**
 * API Admin - Sincronizar Agências dos Correios
 *
 * POST /api/admin/correios-agencies/sync
 * Sincroniza agências do banco com a API dos Correios
 */

import { withApiHandler } from '@/platform/api/handler';
import { requireAdminSession } from '@/platform/auth/require-session';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { AdminPermission } from '@prisma/client';
import {
  listarTodasAgencias,
  mapStatusToEnum,
  mapTipoSiglaToEnum,
  type CorreiosAgenciaAPI,
} from '@/platform/integrations/correios/agencia-client';
import { logger } from '@/platform/logging/logger';

type CorreiosAgencySyncResponse = {
  success: boolean;
  message: string;
  stats: {
    ufsProcessadas: number;
    agenciasProcessadas: number;
    erros: number;
    duration: number;
  };
  errors?: Array<{ uf: string; error: string }>;
};

// UFs do Brasil para sincronização
const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

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

  logger.info({ event: 'correios_sync_start', ufs: targetUfs, clearBefore, staffId: session.staffId }, 'Starting agencies sync');

  const startTime = Date.now();
  const syncedAt = new Date();
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  const errors: Array<{ uf: string; error: string }> = [];

  // Opcional: limpar antes de sincronizar
  if (clearBefore) {
    const deleted = await prisma.correiosAgency.deleteMany({
      where: targetUfs.length < UFS_BRASIL.length ? { uf: { in: targetUfs } } : undefined,
    });
    logger.info({ event: 'correios_sync_cleared', count: deleted.count }, 'Records cleared');
  }

  // Sincronizar por UF
  for (const uf of targetUfs) {
    try {
      logger.debug({ event: 'correios_sync_uf_start', uf }, 'Fetching agencies');

      const agencias = await listarTodasAgencias({ uf, status: 2 });

      logger.debug({ event: 'correios_sync_uf_found', uf, count: agencias.length }, 'Agencies found');

      // OTIMIZAÇÃO N+1: Processar em batches de 100 para evitar queries sequenciais
      const BATCH_SIZE = 100;
      for (let i = 0; i < agencias.length; i += BATCH_SIZE) {
        const batch = agencias.slice(i, i + BATCH_SIZE);
        const agencyIds = batch.map(a => a.id);

        // Buscar todas as existentes do batch de uma vez
        const existingAgencies = await prisma.correiosAgency.findMany({
          where: { id: { in: agencyIds } },
          select: { id: true },
        });
        const existingIds = new Set(existingAgencies.map(a => a.id));

        // Separar em criar vs atualizar
        const toCreate: CorreiosAgenciaAPI[] = [];
        const toUpdate: CorreiosAgenciaAPI[] = [];

        for (const agencia of batch) {
          if (existingIds.has(agencia.id)) {
            toUpdate.push(agencia);
          } else {
            toCreate.push(agencia);
          }
        }

        // Criar novos em batch
        if (toCreate.length > 0) {
          try {
            await prisma.correiosAgency.createMany({
              data: toCreate.map(a => mapAgenciaToDb(a, syncedAt)),
              skipDuplicates: true,
            });
            totalCreated += toCreate.length;
          } catch (err) {
            logger.error({ event: 'correios_sync_create_batch_error', uf, count: toCreate.length, err }, 'Failed to create batch');
            totalErrors += toCreate.length;
          }
        }

        // Atualizar existentes em paralelo (Promise.all é mais eficiente que sequencial)
        if (toUpdate.length > 0) {
          const updateResults = await Promise.allSettled(
            toUpdate.map(agencia => {
              const data = mapAgenciaToDb(agencia, syncedAt);
              return prisma.correiosAgency.update({
                where: { id: agencia.id },
                data: {
                  ...data,
                  createdAt: undefined, // Não atualizar createdAt
                },
              });
            })
          );

          totalUpdated += updateResults.filter(r => r.status === 'fulfilled').length;
          totalErrors += updateResults.filter(r => r.status === 'rejected').length;
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      logger.error({ event: 'correios_sync_uf_error', uf, err }, 'Failed to sync UF');
      errors.push({ uf, error: errorMsg });
      totalErrors++;
    }
  }

  const duration = Date.now() - startTime;

  logger.info({
    event: 'correios_sync_complete',
    durationMs: duration,
    totalAgencias: totalCreated,
    totalUpdated,
    totalErrors,
    errorCount: errors.length,
  }, 'Sync completed');

  return {
    data: {
      success: true,
      message: `Sincronização concluída em ${Math.round(duration / 1000)}s`,
      stats: {
        ufsProcessadas: targetUfs.length,
        agenciasProcessadas: totalCreated,
        erros: totalErrors,
        duration,
      },
      errors: errors.length > 0 ? errors : undefined,
    },
  };
});

/**
 * Mapeia agência da API para formato do banco
 */
function mapAgenciaToDb(agencia: CorreiosAgenciaAPI, syncedAt: Date) {
  // Extrair latitude/longitude do endereço ou do objeto raiz
  const latitude = agencia.endereco.latitude
    ? parseFloat(agencia.endereco.latitude)
    : agencia.latitude || null;
  const longitude = agencia.endereco.longitude
    ? parseFloat(agencia.endereco.longitude)
    : agencia.longitude || null;

  // Extrair horários do objeto horarios ou do objeto raiz
  const horarioFuncionamento = agencia.horarios?.funcionamento || agencia.horarioFuncionamento || null;
  const iniExpediente = agencia.horarios?.iniExpediente || agencia.iniExpediente || null;
  const fimExpediente = agencia.horarios?.fimExpediente || agencia.fimExpediente || null;

  return {
    id: agencia.id,
    nome: agencia.nome,
    status: mapStatusToEnum(agencia.status),
    statusCodigo: parseInt(String(agencia.status), 10) || 0,
    statusDescricao: agencia.descStatus || null,
    tipoUnidadeCodigo: agencia.tipoUnidade.codigo,
    tipoUnidadeDescricao: agencia.tipoUnidade.descricao || null,
    tipoUnidadeSigla: mapTipoSiglaToEnum(agencia.tipoUnidade.sigla),
    cep: agencia.endereco.cep.replace(/\D/g, ''),
    uf: agencia.endereco.uf,
    municipio: agencia.endereco.municipio || agencia.endereco.localidade || '',
    bairro: agencia.endereco.bairro || null,
    logradouro: agencia.endereco.logradouro || null,
    numero: agencia.endereco.numero || null,
    complemento: agencia.endereco.complemento || null,
    latitude,
    longitude,
    horarioFuncionamento,
    iniExpediente,
    fimExpediente,
    syncedAt,
  };
}
