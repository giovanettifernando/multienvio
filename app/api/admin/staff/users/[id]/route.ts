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

type StaffUserResponse = {
  user: StaffUserApi;
};

type StaffUserDeleteResponse = {
  message: string;
};

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
    status: user.status === 'BLOCKED' ? 'blocked' as const : 'active' as const,
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

export const GET = withApiHandler<StaffUserResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.USUARIOS)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

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
    throw new ApiError({ code: 'not_found', message: 'Usuário não encontrado', status: 404 });
  }

  return { data: { user: toApiUser(user) } };
});

export const PUT = withApiHandler<StaffUserResponse, { id: string }>(async (context) => {
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
  const payload = updateSchema.parse(body);

  const existing = await prisma.staffUser.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError({ code: 'not_found', message: 'Usuário não encontrado', status: 404 });
  }

  if (payload.email && payload.email !== existing.email) {
    const emailExists = await prisma.staffUser.findUnique({ where: { email: payload.email } });
    if (emailExists) {
      throw new ApiError({ code: 'conflict', message: 'E-mail já cadastrado', status: 409 });
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
    throw new ApiError({ code: 'validation_error', message: 'Selecione ao menos uma permissão', status: 400 });
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

  return { data: { user: toApiUser(updated) } };
});

export const DELETE = withApiHandler<StaffUserDeleteResponse, { id: string }>(async (context) => {
  const { req, params } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.USUARIOS)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.staffUser.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError({ code: 'not_found', message: 'Usuário não encontrado', status: 404 });
  }

  await prisma.staffUser.delete({ where: { id } });

  return { data: { message: 'Usuário excluído com sucesso' } };
});
