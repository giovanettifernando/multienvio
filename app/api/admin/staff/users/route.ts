export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { AdminPermission, Prisma, StaffStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

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



export async function GET(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.USUARIOS);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
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

    return NextResponse.json({
      items,
      users,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[ADMIN_STAFF_USERS_GET]', error);
    return NextResponse.json({ message: 'Erro ao carregar usuários' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.USUARIOS);
    if (authResult instanceof NextResponse) return authResult;

    const payload = createSchema.parse(await request.json());

    const existing = await prisma.staffUser.findUnique({ where: { email: payload.email } });
    if (existing) {
      return NextResponse.json({ message: 'E-mail já cadastrado' }, { status: 409 });
    }

    const isSuperAdmin = Boolean(payload.isSuperAdmin);
    const permissions = Array.from(new Set(payload.permissions ?? []));

    if (!isSuperAdmin && permissions.length === 0) {
      return NextResponse.json(
        { message: 'Selecione ao menos uma permissão' },
        { status: 400 },
      );
    }

    const tempPassword = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const roleId = await resolveRoleId(isSuperAdmin);
    if (!roleId) {
      return NextResponse.json(
        { message: 'Nenhum papel padrão configurado para staff' },
        { status: 500 },
      );
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

    return NextResponse.json({
      user,
      tempPassword,
    }, { status: 201 });
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
    console.error('[ADMIN_STAFF_USERS_POST]', error);
    return NextResponse.json({ message: 'Erro ao criar usuário' }, { status: 500 });
  }
}
