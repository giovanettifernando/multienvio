
import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { prisma } from '@/lib/db';
import { AdminPermission } from '@prisma/client';

export async function GET(request: Request) {
  try {
    // Get admin session from cookie
    const session = await getAdminSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Find staff user in database
    const staffUser = await prisma.staffUser.findUnique({
      where: { id: session.staffId },
      include: {
        role: true,
      },
    });

    if (!staffUser) {
      return NextResponse.json(
        { message: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Check if staff is active
    if (staffUser.status !== 'ACTIVE') {
      return NextResponse.json(
        { message: 'Conta inativa ou bloqueada' },
        { status: 403 }
      );
    }

    // Return staff data (without passwordHash)
    const staff = {
      id: staffUser.id,
      name: staffUser.name,
      email: staffUser.email,
      status: staffUser.status,
      role: staffUser.role?.name,
      isSuperAdmin: staffUser.isSuperAdmin,
      permissions: staffUser.isSuperAdmin
        ? Object.values(AdminPermission)
        : staffUser.permissions,
      lastLoginAt: staffUser.lastLoginAt?.toISOString() || null,
      lastAccessAt: staffUser.lastAccessAt?.toISOString() || null,
      createdAt: staffUser.createdAt.toISOString(),
      updatedAt: staffUser.updatedAt.toISOString(),
    };

    return NextResponse.json({ staff });
  } catch (error) {
    console.error('[ADMIN_ME_ERROR]', error);
    return NextResponse.json(
      { message: 'Erro ao buscar dados do usuário' },
      { status: 500 }
    );
  }
}
