export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { AdminPermission, StaffStatus } from '@prisma/client';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().optional().nullable(),
  status: z.nativeEnum(StaffStatus).optional(),
  isSuperAdmin: z.boolean().optional(),
  permissions: z.array(z.nativeEnum(AdminPermission)).optional(),
});



function toApiUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: StaffStatus;
  isSuperAdmin: boolean;
  permissions: AdminPermission[];
  lastAccessAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const effectivePermissions = user.isSuperAdmin
    ? (Object.values(AdminPermission) as AdminPermission[])
    : user.permissions;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status === 'BLOCKED' ? 'blocked' : 'active',
    isSuperAdmin: user.isSuperAdmin,
    permissions: effectivePermissions,
    roles: user.isSuperAdmin
      ? ['admin.super', ...effectivePermissions]
      : effectivePermissions,
    lastAccessAt: user.lastAccessAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.USUARIOS);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const user = await prisma.staffUser.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        isSuperAdmin: true,
        permissions: true,
        lastAccessAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ user: toApiUser(user) });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[ADMIN_STAFF_USERS_GET_ID]', error);
    return NextResponse.json({ message: 'Erro ao carregar usuário' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.USUARIOS);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const payload = updateSchema.parse(await request.json());

    const existing = await prisma.staffUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }

    if (payload.email && payload.email !== existing.email) {
      const emailExists = await prisma.staffUser.findUnique({ where: { email: payload.email } });
      if (emailExists) {
        return NextResponse.json({ message: 'E-mail já cadastrado' }, { status: 409 });
      }
    }

    let isSuperAdmin = existing.isSuperAdmin;
    let permissions = existing.permissions;

    if (typeof payload.isSuperAdmin === 'boolean') {
      isSuperAdmin = payload.isSuperAdmin;
      if (isSuperAdmin) {
        permissions = [];
      }
    }

    if (Array.isArray(payload.permissions)) {
      permissions = Array.from(new Set(payload.permissions));
    }

    if (!isSuperAdmin && permissions.length === 0) {
      return NextResponse.json(
        { message: 'Selecione ao menos uma permissão' },
        { status: 400 },
      );
    }

    const updated = await prisma.staffUser.update({
      where: { id },
      data: {
        name: payload.name ?? undefined,
        email: payload.email ?? undefined,
        phone: payload.phone ?? undefined,
        status: payload.status ?? undefined,
        isSuperAdmin,
        permissions: isSuperAdmin ? [] : permissions,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        isSuperAdmin: true,
        permissions: true,
        lastAccessAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user: toApiUser(updated) });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: error.flatten() },
        { status: 400 },
      );
    }
    console.error('[ADMIN_STAFF_USERS_PUT_ID]', error);
    return NextResponse.json({ message: 'Erro ao atualizar usuário' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.USUARIOS);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    const existing = await prisma.staffUser.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }

    await prisma.staffUser.delete({ where: { id } });

    return NextResponse.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[ADMIN_STAFF_USERS_DELETE_ID]', error);
    return NextResponse.json({ message: 'Erro ao excluir usuário' }, { status: 500 });
  }
}
