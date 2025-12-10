/**
 * PUT /api/admin/clients/[id]/profile
 *
 * Atualiza o perfil de um usuário da plataforma (Admin)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { logger } from '@/lib/logger';

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  hasCompany: z.boolean().optional(),
  razaoSocial: z.string().nullable().optional(),
  status: z.enum(['active', 'pending', 'blocked', 'suspended']).optional(),
  emailVerified: z.boolean().optional(),
});

export const PUT = withApiHandler<unknown, { id: string }>(async ({ req, params }) => {
  const authResult = await requireAdminUser(req, AdminPermission.CONTAS);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  const { id } = params;
  const body = await req.json();

  // Validar dados
  const validation = updateProfileSchema.safeParse(body);
  if (!validation.success) {
    throw new ApiError({
      code: 'BAD_REQUEST',
      message: 'Dados inválidos',
      status: 400,
      details: validation.error.flatten(),
    });
  }

  const data = validation.data;

  // Verificar se usuário existe
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });

  if (!existingUser) {
    throw new ApiError({
      code: 'NOT_FOUND',
      message: 'Usuário não encontrado',
      status: 404,
    });
  }

  // Se está alterando email, verificar se já existe
  if (data.email && data.email !== existingUser.email) {
    const emailExists = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (emailExists) {
      throw new ApiError({
        code: 'BAD_REQUEST',
        message: 'Este email já está em uso',
        status: 400,
      });
    }
  }

  // Atualizar usuário
  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.cpf !== undefined && { cpf: data.cpf }),
      ...(data.cnpj !== undefined && { cnpj: data.cnpj }),
      ...(data.hasCompany !== undefined && { hasCompany: data.hasCompany }),
      ...(data.razaoSocial !== undefined && { razaoSocial: data.razaoSocial }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.emailVerified !== undefined && {
        emailVerified: data.emailVerified,
        emailVerifiedAt: data.emailVerified ? new Date() : null,
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      cnpj: true,
      hasCompany: true,
      razaoSocial: true,
      status: true,
      emailVerified: true,
      updatedAt: true,
    },
  });

  // Log de auditoria
  logger.info({
    event: 'admin_update_profile',
    adminId: authResult.user.id,
    userId: id,
    changes: data,
  }, 'Admin updated user profile');

  return {
    data: {
      message: 'Perfil atualizado com sucesso',
      user: updatedUser,
    },
  };
});
