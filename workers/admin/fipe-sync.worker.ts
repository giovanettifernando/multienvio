/**
 * Worker: FIPE Vehicle Sync
 *
 * Substitui a execução síncrona de 5 minutos em /api/admin/fipe/sync.
 * A API route agora enfileira jobs e retorna 202.
 *
 * Fluxo:
 * 1. Job 'brands': busca marcas de um tipo de veículo, enfileira sub-jobs 'models' por marca
 * 2. Job 'models': busca modelos de uma marca específica
 */

import { Worker, type Job } from 'bullmq';
import { queueConnection, getQueue, QUEUE_NAMES, type FipeSyncJobPayload } from '../../platform/queue';
import { createJobLogger, type JobLogger } from '../../platform/queue/helpers';
import { prisma } from '../../platform/db/db';
import {
  getCurrentReference,
  getBrands,
  getModels,
  type FipeVehicleType,
} from '../../platform/integrations/fipe/client';
import type { FipeVehicleType as PrismaFipeVehicleType } from '@prisma/client';

const CONCURRENCY = 2;

async function processFipeSyncJob(job: Job<FipeSyncJobPayload>): Promise<void> {
  const log = createJobLogger(job);
  const { mode, vehicleType, brandCode, forceUpdate } = job.data;

  if (mode === 'brands') {
    await processBrands(vehicleType, forceUpdate, log);
  } else if (mode === 'models' && brandCode) {
    await processModels(vehicleType, brandCode, log);
  } else {
    throw new Error(`Modo inválido: ${mode}`);
  }
}

/**
 * Busca referência atual + marcas de um tipo, enfileira sub-jobs por marca.
 */
async function processBrands(
  vehicleType: FipeVehicleType,
  forceUpdate: boolean | undefined,
  log: JobLogger,
): Promise<void> {
  const reference = await getCurrentReference();
  const referenceCode = parseInt(reference.code, 10);

  log.info({ vehicleType, referenceCode, referenceMonth: reference.month }, 'Fetching brands');

  const brands = await getBrands(vehicleType, referenceCode);

  log.info({ vehicleType, brandCount: brands.length }, 'Brands fetched, enqueueing model jobs');

  // Enfileirar um job por marca
  const queue = getQueue<FipeSyncJobPayload>(QUEUE_NAMES.FIPE_SYNC);
  const jobs = brands.map((brand) => ({
    name: 'models',
    data: {
      mode: 'models' as const,
      vehicleType,
      brandCode: brand.code,
      referenceCode: referenceCode.toString(),
      forceUpdate,
    },
    opts: { jobId: `fipe-models-${vehicleType}-${brand.code}-${referenceCode}` },
  }));

  await queue.addBulk(jobs);

  // Upsert marcas no banco
  for (const brand of brands) {
    await upsertBrand(vehicleType, brand, referenceCode, reference.month);
  }

  log.info({ vehicleType, brandsUpserted: brands.length }, 'Brands upserted');
}

/**
 * Busca modelos de uma marca e upsert no banco.
 */
async function processModels(
  vehicleType: FipeVehicleType,
  brandCode: string,
  log: JobLogger,
): Promise<void> {
  const reference = await getCurrentReference();
  const referenceCode = parseInt(reference.code, 10);

  // Buscar brand ID no banco
  const brand = await prisma.fipeVehicleBrand.findFirst({
    where: {
      vehicleType: vehicleType as PrismaFipeVehicleType,
      fipeCode: brandCode,
      referenceCode,
    },
    select: { id: true, name: true },
  });

  if (!brand) {
    log.warn({ vehicleType, brandCode, referenceCode }, 'Brand not found in DB, skipping');
    return;
  }

  const models = await getModels(vehicleType, brandCode, referenceCode);

  for (const model of models) {
    await upsertModel(brand.id, vehicleType, model, referenceCode, reference.month);
  }

  log.info({ vehicleType, brandCode, brandName: brand.name, modelsUpserted: models.length }, 'Models upserted');
}

async function upsertBrand(
  vehicleType: FipeVehicleType,
  brand: { code: string; name: string },
  referenceCode: number,
  referenceMonth: string,
): Promise<void> {
  const prismaVehicleType = vehicleType as PrismaFipeVehicleType;

  await prisma.fipeVehicleBrand.upsert({
    where: {
      fipe_brand_unique: {
        vehicleType: prismaVehicleType,
        fipeCode: brand.code,
        referenceCode,
      },
    },
    update: {
      name: brand.name,
      referenceMonth,
      isActive: true,
    },
    create: {
      vehicleType: prismaVehicleType,
      fipeCode: brand.code,
      name: brand.name,
      referenceCode,
      referenceMonth,
      isActive: true,
    },
  });
}

async function upsertModel(
  brandId: string,
  vehicleType: FipeVehicleType,
  model: { code: string; name: string },
  referenceCode: number,
  referenceMonth: string,
): Promise<void> {
  const prismaVehicleType = vehicleType as PrismaFipeVehicleType;

  await prisma.fipeVehicleModel.upsert({
    where: {
      fipe_model_unique: {
        brandId,
        fipeCode: model.code,
        referenceCode,
      },
    },
    update: {
      name: model.name,
      referenceMonth,
      isActive: true,
    },
    create: {
      brandId,
      vehicleType: prismaVehicleType,
      fipeCode: model.code,
      name: model.name,
      referenceCode,
      referenceMonth,
      isActive: true,
    },
  });
}

export function createFipeSyncWorker(): Worker<FipeSyncJobPayload> {
  return new Worker<FipeSyncJobPayload>(
    QUEUE_NAMES.FIPE_SYNC,
    processFipeSyncJob,
    {
      connection: queueConnection,
      concurrency: CONCURRENCY,
    },
  );
}
