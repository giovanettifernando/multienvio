import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { z } from 'zod';
import { prisma } from '@/platform/db/db';
import { AdminPermission, StaffStatus } from '@prisma/client';

type StaffUserApi = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'blocked';
  isSuperAdmin: boolean;
  permissions: AdminPermission[];
  roles: string[];
  lastAccessAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type StaffUserStatusResponse = {
  user: StaffUserApi;
};

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
    status: (user.status === 'BLOCKED' ? 'blocked' : 'active') as 'active' | 'blocked',
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

export const PATCH = withApiHandler<StaffUserStatusResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.USUARIOS)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const payload = schema.parse(body);

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

  return { data: { user: toApiUser(user) } };
});
