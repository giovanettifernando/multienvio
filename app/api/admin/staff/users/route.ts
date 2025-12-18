import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { z } from 'zod';
import { prisma } from '@/platform/db/db';
import { AdminPermission, Prisma, StaffStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { sendStaffTempPasswordEmail } from '@/platform/email/mailer';

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

type StaffUsersListResponse = {
  items: StaffUserApi[];
  users: Array<{ id: string; name: string; email: string }>;
  total: number;
  page: number;
  pageSize: number;
};

type StaffUserCreateResponse = {
  user: StaffUserApi;
  passwordGenerated: boolean;
};

async function resolveRoleId(isSuperAdmin: boolean): Promise<string | null> {
  const preferredName = isSuperAdmin ? 'admin' : 'operator';

  const preferredRole = await prisma.staffRole.findFirst({
    where: { name: preferredName },
    select: { id: true },
  });
  if (preferredRole) return preferredRole.id;

  const fallbackRole = await prisma.staffRole.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  return fallbackRole?.id ?? null;
}

const filtersSchema = z.object({
  q: z.string().optional(),
  status: z.enum(['all', 'active', 'blocked']).optional(),
  permission: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sort: z.enum(['name_asc', 'name_desc', 'updated_asc', 'updated_desc']).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().min(1).email().toLowerCase(),
  phone: z.string().trim().optional().nullable(),
  status: z.nativeEnum(StaffStatus),
  isSuperAdmin: z.boolean().optional().default(false),
  permissions: z.array(z.nativeEnum(AdminPermission)).optional().default([]),
});

function parsePermission(value?: string | null): AdminPermission | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return (Object.values(AdminPermission) as string[]).includes(upper)
    ? (upper as AdminPermission)
    : null;
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

export const GET = withApiHandler<StaffUsersListResponse>(async (context) => {
  const { req } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.USUARIOS)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filters = filtersSchema.parse(Object.fromEntries(searchParams));

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;

  const whereClauses: Prisma.StaffUserWhereInput[] = [];

  if (filters.q) {
    whereClauses.push({
      OR: [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
      ],
    });
  }

  if (filters.status && filters.status !== 'all') {
    whereClauses.push({ status: filters.status === 'blocked' ? 'BLOCKED' : 'ACTIVE' });
  }

  const permissionFilter = parsePermission(filters.permission);
  if (permissionFilter) {
    whereClauses.push({
      OR: [
        { isSuperAdmin: true },
        { permissions: { has: permissionFilter } },
      ],
    });
  }

  const where = whereClauses.length ? { AND: whereClauses } : {};

  let orderBy: Record<string, 'asc' | 'desc'> = { updatedAt: 'desc' };
  switch (filters.sort) {
    case 'name_asc':
      orderBy = { name: 'asc' };
      break;
    case 'name_desc':
      orderBy = { name: 'desc' };
      break;
    case 'updated_asc':
      orderBy = { updatedAt: 'asc' };
      break;
    case 'updated_desc':
    default:
      orderBy = { updatedAt: 'desc' };
      break;
  }

  const [records, total] = await prisma.$transaction([
    prisma.staffUser.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    }),
    prisma.staffUser.count({ where }),
  ]);

  const items = records.map(toApiUser);
  const users = items.map(({ id, name, email }) => ({ id, name, email }));

  return {
    data: {
      items,
      users,
      total,
      page,
      pageSize,
    },
  };
});

export const POST = withApiHandler<StaffUserCreateResponse>(async (context) => {
  const { req, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autenticado', status: 401 });
  }

  if (!session.permissions.includes(AdminPermission.USUARIOS)) {
    throw new ApiError({ code: 'forbidden', message: 'Permissão negada', status: 403 });
  }

  const body = await req.json();
  const payload = createSchema.parse(body);

  const existing = await prisma.staffUser.findUnique({ where: { email: payload.email } });
  if (existing) {
    throw new ApiError({ code: 'conflict', message: 'E-mail já cadastrado', status: 409 });
  }

  const isSuperAdmin = Boolean(payload.isSuperAdmin);
  const permissions = Array.from(new Set(payload.permissions ?? []));

  if (!isSuperAdmin && permissions.length === 0) {
    throw new ApiError({ code: 'validation_error', message: 'Selecione ao menos uma permissão', status: 400 });
  }

  const tempPassword = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const roleId = await resolveRoleId(isSuperAdmin);
  if (!roleId) {
    throw new ApiError({ code: 'server_error', message: 'Nenhum papel padrão configurado para staff', status: 500 });
  }

  const created = await prisma.staffUser.create({
    data: {
      name: payload.name,
      email: payload.email,
      phone: payload.phone ?? null,
      status: payload.status,
      roleId,
      isSuperAdmin,
      permissions: isSuperAdmin ? [] : permissions,
      passwordHash,
    },
  });

  const user = toApiUser({
    ...created,
    permissions: created.permissions,
    phone: created.phone ?? null,
    lastAccessAt: created.lastAccessAt ?? null,
    lastLoginAt: created.lastLoginAt ?? null,
  });

  // Enviar email com senha temporária (não bloqueia a resposta)
  sendStaffTempPasswordEmail(payload.email, payload.name, tempPassword)
    .then((sent) => {
      if (sent) {
        logger.info('staff_user_temp_password_email_sent', { email: payload.email, userId: created.id });
      } else {
        logger.warn('staff_user_temp_password_email_failed', { email: payload.email, userId: created.id });
      }
    })
    .catch((err) => {
      logger.error('staff_user_temp_password_email_error', { email: payload.email, error: String(err) });
    });

  logger.info('staff_user_created', { userId: created.id, email: payload.email, isSuperAdmin });

  return {
    data: {
      user,
      passwordGenerated: true,
    },
    status: 201,
  };
});
