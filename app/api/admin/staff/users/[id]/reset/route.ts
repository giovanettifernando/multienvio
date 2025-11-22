export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { AdminPermission } from '@prisma/client';
import { logPasswordReset } from '@/lib/audit-admin';
import { rateLimitByUser, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.USUARIOS);
    if (authResult instanceof NextResponse) return authResult;
    const { session } = authResult;

    // Rate limiting
    const rateLimitError = rateLimitByUser(session.staffId, 'password_reset', RATE_LIMITS.PASSWORD_RESET);
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
    await logPasswordReset(session.staffId, id, 'StaffUser');

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
