import { prisma } from '@/lib/db';
import type { PackagingTemplate } from '@prisma/client';
import type { PackagingCreateOutput, PackagingUpdateOutput } from '@/lib/validation/packaging';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Formata um número removendo zeros desnecessários
 */
function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/**
 * Gera nome automático no formato C (xx) x L (xx) x A (xx)
 */
function generateAutoName(lengthCm: number, widthCm: number, heightCm: number): string {
  const length = formatNumber(lengthCm);
  const width = formatNumber(widthCm);
  const height = formatNumber(heightCm);
  return `C (${length}) x L (${width}) x A (${height})`;
}

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
