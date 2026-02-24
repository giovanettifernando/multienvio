/**
 * Worker: Correios Agencies Sync
 *
 * Substitui a execução síncrona em /api/admin/correios-agencies/sync.
 * Cada job sincroniza agências de uma UF específica.
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection, QUEUE_NAMES, type CorreiosAgenciesSyncJobPayload } from '../../platform/queue';
import { createJobLogger } from '../../platform/queue/helpers';
import { prisma } from '../../platform/db/db';
import {
  listarTodasAgencias,
  mapStatusToEnum,
  mapTipoSiglaToEnum,
  type CorreiosAgenciaAPI,
} from '../../platform/integrations/correios/agencia-client';

const CONCURRENCY = 2;
const BATCH_SIZE = 100;

async function processCorreiosAgenciesSync(job: Job<CorreiosAgenciesSyncJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { uf, clearBefore } = job.data;
  const syncedAt = new Date();

  log.info({ uf, clearBefore }, 'Starting agencies sync for UF');

  // Limpar registros antes se solicitado
  if (clearBefore) {
    const deleted = await prisma.correiosAgency.deleteMany({
      where: { uf },
    });
    log.info({ uf, deletedCount: deleted.count }, 'Cleared existing records');
  }

  // Buscar agências da API dos Correios
  const agencias = await listarTodasAgencias({ uf, status: 2 });

  log.info({ uf, agenciasCount: agencias.length }, 'Agencies fetched from Correios API');

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  // Processar em batches
  for (let i = 0; i < agencias.length; i += BATCH_SIZE) {
    const batch = agencias.slice(i, i + BATCH_SIZE);
    const agencyIds = batch.map(a => a.id);

    // Buscar existentes
    const existing = await prisma.correiosAgency.findMany({
      where: { id: { in: agencyIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map(a => a.id));

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
        log.error({ uf, batchSize: toCreate.length, error: err instanceof Error ? err.message : String(err) },
          'Failed to create batch');
        totalErrors += toCreate.length;
      }
    }

    // Atualizar existentes
    if (toUpdate.length > 0) {
      const results = await Promise.allSettled(
        toUpdate.map(agencia => {
          const data = mapAgenciaToDb(agencia, syncedAt);
          return prisma.correiosAgency.update({
            where: { id: agencia.id },
            data: { ...data, createdAt: undefined },
          });
        }),
      );

      totalUpdated += results.filter(r => r.status === 'fulfilled').length;
      totalErrors += results.filter(r => r.status === 'rejected').length;
    }
  }

  log.info({ uf, totalCreated, totalUpdated, totalErrors }, 'Agencies sync completed for UF');
}

function mapAgenciaToDb(agencia: CorreiosAgenciaAPI, syncedAt: Date) {
  const latitude = agencia.endereco.latitude
    ? parseFloat(agencia.endereco.latitude)
    : agencia.latitude || null;
  const longitude = agencia.endereco.longitude
    ? parseFloat(agencia.endereco.longitude)
    : agencia.longitude || null;

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

export function createCorreiosAgenciesSyncWorker(): Worker<CorreiosAgenciesSyncJobPayload> {
  return new Worker<CorreiosAgenciesSyncJobPayload>(
    QUEUE_NAMES.CORREIOS_AGENCIES_SYNC,
    processCorreiosAgenciesSync,
    {
      connection: queueConnection,
      concurrency: CONCURRENCY,
    },
  );
}
