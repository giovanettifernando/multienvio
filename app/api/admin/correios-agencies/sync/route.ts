/**
 * API Admin - Sincronizar Agências dos Correios
 *
 * POST /api/admin/correios-agencies/sync
 * Sincroniza agências do banco com a API dos Correios
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { prisma } from '@/lib/db';
import { AdminPermission } from '@prisma/client';
import {
  listarTodasAgencias,
  mapStatusToEnum,
  mapTipoSiglaToEnum,
  type CorreiosAgenciaAPI,
} from '@/lib/correios/agencia-client';
import { logger } from '@/lib/logger';

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

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

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

      // Upsert em lote
      for (const agencia of agencias) {
        try {
          const data = mapAgenciaToDb(agencia, syncedAt);

          await prisma.correiosAgency.upsert({
            where: { id: agencia.id },
            create: data,
            update: {
              ...data,
              createdAt: undefined, // Não atualizar createdAt
            },
          });

          // Contar como criado ou atualizado (aproximação)
          totalUpdated++;
        } catch (err) {
          logger.error({ event: 'correios_sync_agency_error', agencyId: agencia.id, err }, 'Failed to save agency');
          totalErrors++;
        }
      }

      totalCreated += agencias.length;
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
