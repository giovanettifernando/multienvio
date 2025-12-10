/**
 * PUT/DELETE /api/admin/clients/[id]/addresses/[addressId]
 *
 * Atualiza ou remove endereço de um usuário (Admin)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { logger } from '@/lib/logger';

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
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

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
    adminId: authResult.user.id,
    userId,
    addressId,
  }, 'Admin updated address');

  return { data: { message: 'Endereço atualizado com sucesso', address } };
});

// DELETE - Remover endereço
export const DELETE = withApiHandler<unknown, { id: string; addressId: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

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
    adminId: authResult.user.id,
    userId,
    addressId,
  }, 'Admin deleted address');

  return { data: { message: 'Endereço removido com sucesso' } };
});
