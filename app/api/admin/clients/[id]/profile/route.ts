/**
 * PUT /api/admin/clients/[id]/profile
 *
 * Atualiza o perfil de um usuário da plataforma (Admin)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;
    const body = await request.json();

    // Validar dados
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verificar se usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!existingUser) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }

    // Se está alterando email, verificar se já existe
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });

      if (emailExists) {
        return NextResponse.json({ message: 'Este email já está em uso' }, { status: 400 });
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
    console.log('[ADMIN_UPDATE_PROFILE]', {
      adminId: authResult.user.id,
      userId: id,
      changes: data,
    });

    return NextResponse.json({
      message: 'Perfil atualizado com sucesso',
      user: updatedUser,
    });
  } catch (error) {
    console.error('[ADMIN_UPDATE_PROFILE_ERROR]', error);
    return NextResponse.json({ message: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
