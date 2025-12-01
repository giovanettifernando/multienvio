import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { UserStatus, AuthRole, type User } from '@/types/contracts';


export async function GET() {
  try {
    // Obter sessão do cookie JWT
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Buscar usuário no banco
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        role: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { message: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se usuário está ativo
    if (dbUser.status !== UserStatus.ACTIVE) {
      return NextResponse.json(
        { message: 'Conta inativa ou bloqueada' },
        { status: 403 }
      );
    }

    // Mapear para o tipo User global (sem expor passwordHash)
    const user: User = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      avatarUrl: dbUser.avatarUrl,
      status: dbUser.status as UserStatus,
      roles: dbUser.role?.name === 'admin' ? [AuthRole.ADMIN] : [],
      lastLoginAt: dbUser.lastLoginAt?.toISOString() || null,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    };

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar usuário' },
      { status: 500 }
    );
  }
}
