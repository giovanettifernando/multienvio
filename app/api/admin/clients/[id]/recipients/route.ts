/**
 * GET/POST /api/admin/clients/[id]/recipients
 *
 * Gerencia destinatários recorrentes de um usuário (Admin)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { logger } from '@/lib/logger';

const recipientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().nullable().optional(),
  document: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  cep: z.string().min(8).max(8),
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  uf: z.string().length(2),
});

// GET - Listar destinatários
export const GET = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const userId = params.id;

  const recipients = await prisma.recipient.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return { data: { recipients } };
});

// POST - Criar novo destinatário
export const POST = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const userId = params.id;
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
    await prisma.recipient.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const recipient = await prisma.recipient.create({
    data: {
      userId,
      name: data.name,
      nameSearch: data.name.toLowerCase(),
      email: data.email,
      document: data.document?.replace(/\D/g, '') || null,
      phone: data.phone?.replace(/\D/g, '') || null,
      notes: data.notes,
      isDefault: data.isDefault ?? false,
      cep: data.cep.replace(/\D/g, ''),
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.cidade,
      uf: data.uf.toUpperCase(),
    },
  });

  logger.info({
    event: 'admin_create_recipient',
    adminId: authResult.user.id,
    userId,
    recipientId: recipient.id,
  }, 'Admin created recipient');

  return {
    data: { message: 'Destinatário criado com sucesso', recipient },
    status: 201,
  };
});
