/**
 * PUT/DELETE /api/admin/clients/[id]/recipients/[recipientId]
 *
 * Atualiza ou remove destinatário de um usuário (Admin)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';
import { requireAdminUser } from '@/modules/auth/application/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { logger } from '@/platform/logging/logger';

const recipientSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().nullable().optional(),
  document: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  cep: z.string().min(8).max(8).optional(),
  logradouro: z.string().min(1).optional(),
  numero: z.string().min(1).optional(),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1).optional(),
  cidade: z.string().min(1).optional(),
  uf: z.string().length(2).optional(),
});

// PUT - Atualizar destinatário
export const PUT = withApiHandler<unknown, { id: string; recipientId: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id: userId, recipientId } = params;
  const body = await req.json();

  const validation = recipientSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  // Verificar se destinatário existe e pertence ao usuário
  const existing = await prisma.recipient.findFirst({
    where: { id: recipientId, userId },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Destinatário não encontrado',
      status: 404,
    });
  }

  const data = validation.data;

  // Se for default, remover default de outros
  if (data.isDefault) {
    await prisma.recipient.updateMany({
      where: { userId, isDefault: true, id: { not: recipientId } },
      data: { isDefault: false },
    });
  }

  const recipient = await prisma.recipient.update({
    where: { id: recipientId },
    data: {
      ...(data.name && { name: data.name, nameSearch: data.name.toLowerCase() }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.document !== undefined && {
        document: data.document?.replace(/\D/g, '') || null,
      }),
      ...(data.phone !== undefined && { phone: data.phone?.replace(/\D/g, '') || null }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.cep && { cep: data.cep.replace(/\D/g, '') }),
      ...(data.logradouro && { logradouro: data.logradouro }),
      ...(data.numero && { numero: data.numero }),
      ...(data.complemento !== undefined && { complemento: data.complemento }),
      ...(data.bairro && { bairro: data.bairro }),
      ...(data.cidade && { cidade: data.cidade }),
      ...(data.uf && { uf: data.uf.toUpperCase() }),
    },
  });

  logger.info({
    event: 'admin_update_recipient',
    adminId: authResult.user.id,
    userId,
    recipientId,
  }, 'Admin updated recipient');

  return { data: { message: 'Destinatário atualizado com sucesso', recipient } };
});

// DELETE - Remover destinatário
export const DELETE = withApiHandler<unknown, { id: string; recipientId: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id: userId, recipientId } = params;

  // Verificar se destinatário existe e pertence ao usuário
  const existing = await prisma.recipient.findFirst({
    where: { id: recipientId, userId },
  });

  if (!existing) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Destinatário não encontrado',
      status: 404,
    });
  }

  await prisma.recipient.delete({
    where: { id: recipientId },
  });

  logger.info({
    event: 'admin_delete_recipient',
    adminId: authResult.user.id,
    userId,
    recipientId,
  }, 'Admin deleted recipient');

  return { data: { message: 'Destinatário removido com sucesso' } };
});
