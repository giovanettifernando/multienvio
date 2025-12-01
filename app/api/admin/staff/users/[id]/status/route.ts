
import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { AdminPermission, StaffStatus } from '@prisma/client';

const schema = z.object({
  status: z.nativeEnum(StaffStatus),
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.USUARIOS);
    if (authResult instanceof NextResponse) return authResult;

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
