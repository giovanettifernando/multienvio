/**
 * GET/POST /api/admin/clients/[id]/addresses
 *
 * Gerencia endereços de um usuário da plataforma (Admin)
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
  cep: z.string().min(8).max(8),
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  uf: z.string().length(2),
  isDefault: z.boolean().optional(),
});

// GET - Listar endereços
export const GET = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = params.id;

  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return { data: { addresses } };
});

// POST - Criar novo endereço
export const POST = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const session = await requireAdminSession(req, AdminPermission.CONTAS);

  const userId = params.id;
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

  // Verificar se usuário existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Usuário não encontrado',
      status: 404,
    });
  }

  const data = validation.data;

  // Se for default, remover default de outros
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      userId,
      label: data.label,
      cep: data.cep.replace(/\D/g, ''),
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.cidade,
      uf: data.uf.toUpperCase(),
      isDefault: data.isDefault ?? false,
    },
  });

  logger.info({
    event: 'admin_create_address',
    adminId: session.staffId,
    userId,
    addressId: address.id,
  }, 'Admin created address');

  return {
    data: { message: 'Endereço criado com sucesso', address },
    status: 201,
  };
});
