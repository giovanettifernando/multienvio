/**
 * PUT/DELETE /api/admin/clients/[id]/addresses/[addressId]
 *
 * Atualiza ou remove endereço de um usuário (Admin)
 */

import { z } from 'zod';
import { requireAdminSession } from '@/platform/auth/require-session';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';

import { AdminPermission } from '@prisma/client';
import { logger } from '@/platform/logging/logger';

const addressSchema = z.object({
  label: z.string().optional(),
  cep: z.string().min(8).max(8).optional(),
  logradouro: z.string().min(1).optional(),
  numero: z.string().min(1).optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1).optional(),
  cidade: z.string().min(1).optional(),
  uf: z.string().length(2).optional(),
  isDefault: z.boolean().optional(),
});

// PUT - Atualizar endereço
export const PUT = withApiHandler<unknown, { id: string; addressId: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const { id: userId, addressId } = params;
  const body = await req.json();

  const validation = addressSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  // Verificar se endereço existe e pertence ao usuário
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Endereço não encontrado',
      status: 404,
    });
  }

  const data = validation.data;

  // Se for default, remover default de outros
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true, id: { not: addressId } },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({
    where: { id: addressId },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.cep && { cep: data.cep.replace(/\D/g, '') }),
      ...(data.logradouro && { logradouro: data.logradouro }),
      ...(data.numero && { numero: data.numero }),
      ...(data.complemento !== undefined && { complemento: data.complemento }),
      ...(data.bairro && { bairro: data.bairro }),
      ...(data.cidade && { cidade: data.cidade }),
      ...(data.uf && { uf: data.uf.toUpperCase() }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
    },
  });

  logger.info({
    event: 'admin_update_address',
    adminId: session.staffId,
    userId,
    addressId,
  }, 'Admin updated address');

  return { data: { message: 'Endereço atualizado com sucesso', address } };
});

// DELETE - Remover endereço
export const DELETE = withApiHandler<unknown, { id: string; addressId: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const { id: userId, addressId } = params;

  // Verificar se endereço existe e pertence ao usuário
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Endereço não encontrado',
      status: 404,
    });
  }

  await prisma.address.delete({
    where: { id: addressId },
  });

  logger.info({
    event: 'admin_delete_address',
    adminId: session.staffId,
    userId,
    addressId,
  }, 'Admin deleted address');

  return { data: { message: 'Endereço removido com sucesso' } };
});
