export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import { canAccess } from '@/lib/auth/permissions';
import { logPasswordReset } from '@/lib/audit-admin';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit';

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireAdminUser(request);
    if (!canAccess(staff, AdminPermission.USUARIOS)) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Rate limiting
    const rateLimitError = rateLimitByUser(staff.id, 'password_reset', RATE_LIMITS.PASSWORD_RESET);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    const target = await prisma.staffUser.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!target) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }

    const tempPassword = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await prisma.staffUser.update({
      where: { id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 }, // Invalidate all existing sessions
      },
    });

    // Audit log
    await logPasswordReset(staff.id, id, 'StaffUser');

    return NextResponse.json({
      message: 'Instruções de redefinição de senha enviadas.',
      tempPassword,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[ADMIN_STAFF_USERS_RESET]', error);
    return NextResponse.json({ message: 'Erro ao resetar senha' }, { status: 500 });
  }
}
