/**
 * Serviço de sincronização de marcas e modelos FIPE
 *
 * Sincroniza dados da API FIPE com o banco de dados local.
 * Deve ser executado mensalmente via cron ou manualmente via admin.
 */

import { prisma } from '@/platform/db/db';
import type { FipeVehicleType as PrismaFipeVehicleType } from '@prisma/client';
import {
  getCurrentReference,
  getBrands,
  getModels,
  delay,
  FipeApiError,
  type FipeVehicleType,
  type FipeReference,
} from './client';

// Delay entre chamadas de modelos para evitar rate limit (ms)
const MODEL_REQUEST_DELAY = 250;

export interface SyncOptions {
  /** Tipos de veículos a sincronizar (default: ['cars']) */
  vehicleTypes?: FipeVehicleType[];
  /** Se true, desativa registros de referências antigas */
  deactivateOld?: boolean;
}

export interface SyncResult {
  referenceCode: number;
  referenceMonth: string;
  vehicleTypes: FipeVehicleType[];
  brands: {
    created: number;
    updated: number;
    total: number;
  };
  models: {
    created: number;
    updated: number;
    total: number;
  };
  errors: string[];
  durationMs: number;
}

/**
 * Sincroniza marcas e modelos FIPE com o banco de dados local
 *
 * @param options Opções de sincronização
 * @returns Resultado da sincronização
 */
export async function syncFipeBrandsAndModels(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const vehicleTypes = options.vehicleTypes || ['cars'];
  const deactivateOld = options.deactivateOld ?? true;

  const result: SyncResult = {
    referenceCode: 0,
    referenceMonth: '',
    vehicleTypes,
    brands: { created: 0, updated: 0, total: 0 },
    models: { created: 0, updated: 0, total: 0 },
    errors: [],
    durationMs: 0,
  };

  try {
    // 1. Descobrir referência atual
    console.log('[FIPE Sync] Buscando referência atual...');
    const reference = await getCurrentReference();
    const referenceCode = parseInt(reference.code, 10);

    result.referenceCode = referenceCode;
    result.referenceMonth = reference.month;

    console.log(`[FIPE Sync] Referência: ${reference.month} (code: ${referenceCode})`);

    // 2. Para cada tipo de veículo
    for (const vehicleType of vehicleTypes) {
      console.log(`[FIPE Sync] Processando tipo: ${vehicleType}`);

      try {
        await syncVehicleType(vehicleType, referenceCode, reference.month, result);
      } catch (error) {
        const errorMsg = `Erro ao sincronizar ${vehicleType}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error(`[FIPE Sync] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    // 3. Desativar registros de referências antigas
    if (deactivateOld) {
      console.log('[FIPE Sync] Desativando registros de referências antigas...');
      await deactivateOldRecords(vehicleTypes, referenceCode);
    }

  } catch (error) {
    const errorMsg = `Erro fatal no sync: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    console.error(`[FIPE Sync] ${errorMsg}`);
    result.errors.push(errorMsg);
  }

  result.durationMs = Date.now() - startTime;

  console.log(`[FIPE Sync] Concluído em ${result.durationMs}ms`);
  console.log(`[FIPE Sync] Marcas: ${result.brands.created} criadas, ${result.brands.updated} atualizadas`);
  console.log(`[FIPE Sync] Modelos: ${result.models.created} criados, ${result.models.updated} atualizados`);

  if (result.errors.length > 0) {
    console.warn(`[FIPE Sync] ${result.errors.length} erro(s) encontrado(s)`);
  }

  return result;
}

/**
 * Sincroniza um tipo específico de veículo
 */
async function syncVehicleType(
  vehicleType: FipeVehicleType,
  referenceCode: number,
  referenceMonth: string,
  result: SyncResult
): Promise<void> {
  // Buscar todas as marcas
  const brands = await getBrands(vehicleType, referenceCode);
  console.log(`[FIPE Sync] ${vehicleType}: ${brands.length} marcas encontradas`);

  for (const brand of brands) {
    try {
      // Upsert da marca
      const brandResult = await upsertBrand(vehicleType, brand, referenceCode, referenceMonth);
      if (brandResult.created) {
        result.brands.created++;
      } else {
        result.brands.updated++;
      }
      result.brands.total++;

      // Buscar modelos da marca
      const models = await getModels(vehicleType, brand.code, referenceCode);

      for (const model of models) {
        try {
          const modelResult = await upsertModel(
            brandResult.id,
            vehicleType,
            model,
            referenceCode,
            referenceMonth
          );
          if (modelResult.created) {
            result.models.created++;
          } else {
            result.models.updated++;
          }
          result.models.total++;
        } catch (error) {
          const errorMsg = `Erro ao salvar modelo ${model.name} (${brand.name}): ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          console.error(`[FIPE Sync] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      // Delay para evitar rate limit
      await delay(MODEL_REQUEST_DELAY);

    } catch (error) {
      if (error instanceof FipeApiError && error.statusCode === 404) {
        // Marca sem modelos (pode acontecer)
        console.warn(`[FIPE Sync] Marca ${brand.name} sem modelos (404)`);
      } else {
        const errorMsg = `Erro ao processar marca ${brand.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error(`[FIPE Sync] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
  }
}

/**
 * Upsert de uma marca FIPE
 */
async function upsertBrand(
  vehicleType: FipeVehicleType,
  brand: { code: string; name: string },
  referenceCode: number,
  referenceMonth: string
): Promise<{ id: string; created: boolean }> {
  const prismaVehicleType = vehicleType as PrismaFipeVehicleType;

  // Tenta encontrar registro existente
  const existing = await prisma.fipeVehicleBrand.findUnique({
    where: {
      fipe_brand_unique: {
        vehicleType: prismaVehicleType,
        fipeCode: brand.code,
        referenceCode,
      },
    },
    select: { id: true },
  });

  if (existing) {
    // Update
    await prisma.fipeVehicleBrand.update({
      where: { id: existing.id },
      data: {
        name: brand.name,
        referenceMonth,
        isActive: true,
      },
    });
    return { id: existing.id, created: false };
  }

  // Create
  const created = await prisma.fipeVehicleBrand.create({
    data: {
      vehicleType: prismaVehicleType,
      fipeCode: brand.code,
      name: brand.name,
      referenceCode,
      referenceMonth,
      isActive: true,
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

/**
 * Upsert de um modelo FIPE
 */
async function upsertModel(
  brandId: string,
  vehicleType: FipeVehicleType,
  model: { code: string; name: string },
  referenceCode: number,
  referenceMonth: string
): Promise<{ id: string; created: boolean }> {
  const prismaVehicleType = vehicleType as PrismaFipeVehicleType;

  // Tenta encontrar registro existente
  const existing = await prisma.fipeVehicleModel.findUnique({
    where: {
      fipe_model_unique: {
        brandId,
        fipeCode: model.code,
        referenceCode,
      },
    },
    select: { id: true },
  });

  if (existing) {
    // Update
    await prisma.fipeVehicleModel.update({
      where: { id: existing.id },
      data: {
        name: model.name,
        referenceMonth,
        isActive: true,
      },
    });
    return { id: existing.id, created: false };
  }

  // Create
  const created = await prisma.fipeVehicleModel.create({
    data: {
      brandId,
      vehicleType: prismaVehicleType,
      fipeCode: model.code,
      name: model.name,
      referenceCode,
      referenceMonth,
      isActive: true,
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

/**
 * Desativa registros de referências antigas
 */
async function deactivateOldRecords(
  vehicleTypes: FipeVehicleType[],
  currentReferenceCode: number
): Promise<void> {
  for (const vehicleType of vehicleTypes) {
    const prismaVehicleType = vehicleType as PrismaFipeVehicleType;

    // Desativar marcas antigas
    const brandsDeactivated = await prisma.fipeVehicleBrand.updateMany({
      where: {
        vehicleType: prismaVehicleType,
        referenceCode: { lt: currentReferenceCode },
        isActive: true,
      },
      data: { isActive: false },
    });

    // Desativar modelos antigos
    const modelsDeactivated = await prisma.fipeVehicleModel.updateMany({
      where: {
        vehicleType: prismaVehicleType,
        referenceCode: { lt: currentReferenceCode },
        isActive: true,
      },
      data: { isActive: false },
    });

    if (brandsDeactivated.count > 0 || modelsDeactivated.count > 0) {
      console.log(
        `[FIPE Sync] ${vehicleType}: ${brandsDeactivated.count} marcas e ${modelsDeactivated.count} modelos desativados`
      );
    }
  }
}

/**
 * Busca marcas ativas para uso em selects
 */
export async function getActiveBrands(vehicleType: FipeVehicleType = 'cars') {
  return prisma.fipeVehicleBrand.findMany({
    where: {
      vehicleType: vehicleType as PrismaFipeVehicleType,
      isActive: true,
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      fipeCode: true,
      name: true,
    },
  });
}

/**
 * Busca modelos ativos de uma marca para uso em selects
 */
export async function getActiveModels(brandId: string) {
  return prisma.fipeVehicleModel.findMany({
    where: {
      brandId,
      isActive: true,
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      fipeCode: true,
      name: true,
    },
  });
}

/**
 * Busca estatísticas da base FIPE local
 */
export async function getFipeStats() {
  const [brandsCount, modelsCount, latestBrand] = await Promise.all([
    prisma.fipeVehicleBrand.count({ where: { isActive: true } }),
    prisma.fipeVehicleModel.count({ where: { isActive: true } }),
    prisma.fipeVehicleBrand.findFirst({
      where: { isActive: true },
      orderBy: { referenceCode: 'desc' },
      select: { referenceCode: true, referenceMonth: true },
    }),
  ]);

  return {
    brandsCount,
    modelsCount,
    latestReferenceCode: latestBrand?.referenceCode ?? null,
    latestReferenceMonth: latestBrand?.referenceMonth ?? null,
  };
}
