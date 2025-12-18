/**
 * Server-side packaging service - database operations
 * This file should only be imported in server contexts (API routes, server actions)
 */

import { prisma } from '@/platform/db/db';
import type { PackagingTemplate } from '@prisma/client';
import type { PackagingCreateOutput, PackagingUpdateOutput } from '@/shared/validation/packaging';
import { Decimal } from '@prisma/client/runtime/client';
import { generateAutoName } from '@/shared/utils/packaging';

/**
 * Lista todas as embalagens do usuário
 */
export async function listByUser(userId: string): Promise<PackagingTemplate[]> {
  return prisma.packagingTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Cria uma nova embalagem para o usuário
 */
export async function create(
  userId: string,
  data: PackagingCreateOutput
): Promise<PackagingTemplate> {
  return prisma.packagingTemplate.create({
    data: {
      userId,
      name: data.name || generateAutoName(data.lengthCm, data.widthCm, data.heightCm),
      lengthCm: new Decimal(data.lengthCm),
      widthCm: new Decimal(data.widthCm),
      heightCm: new Decimal(data.heightCm),
    },
  });
}

/**
 * Atualiza uma embalagem existente do usuário
 */
export async function update(
  userId: string,
  id: string,
  data: PackagingUpdateOutput
): Promise<PackagingTemplate> {
  // Verificar se a embalagem pertence ao usuário
  const existing = await prisma.packagingTemplate.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new Error('Embalagem não encontrada');
  }

  return prisma.packagingTemplate.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.lengthCm !== undefined && { lengthCm: new Decimal(data.lengthCm) }),
      ...(data.widthCm !== undefined && { widthCm: new Decimal(data.widthCm) }),
      ...(data.heightCm !== undefined && { heightCm: new Decimal(data.heightCm) }),
    },
  });
}

/**
 * Remove uma embalagem do usuário
 */
export async function remove(userId: string, id: string): Promise<void> {
  // Verificar se a embalagem pertence ao usuário
  const existing = await prisma.packagingTemplate.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new Error('Embalagem não encontrada');
  }

  await prisma.packagingTemplate.delete({
    where: { id },
  });
}
