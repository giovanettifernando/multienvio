export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission, StaffStatus } from '@prisma/client';
import { canAccess } from '@/lib/auth/permissions';

const schema = z.object({
  status: z.nativeEnum(StaffStatus),
});

async function requireAdminUser(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    throw NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const staffUser = await prisma.staffUser.findUnique({
    where: { id: session.staffId },
    select: {
      id: true,
      status: true,
      isSuperAdmin: true,
      permissions: true,
    },
  });

  if (!staffUser) {
    throw NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
  }

  if (staffUser.status !== 'ACTIVE') {
    throw NextResponse.json({ message: 'Conta inativa ou bloqueada' }, { status: 403 });
  }

  return staffUser;
}

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireAdminUser(request);
    if (!canAccess(staff, AdminPermission.USUARIOS)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const payload = schema.parse(await request.json());

    const user = await prisma.staffUser.update({
      where: { id },
      data: { status: payload.status },
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

    return NextResponse.json({ user: toApiUser(user) });
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
    console.error('[ADMIN_STAFF_USERS_STATUS]', error);
    return NextResponse.json({ message: 'Erro ao atualizar status' }, { status: 500 });
  }
}
