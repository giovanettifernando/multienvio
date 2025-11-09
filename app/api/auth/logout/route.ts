import { NextResponse } from 'next/server';
import { destroySession, getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Obter sessão atual para invalidar tokens
    const session = await getSession();

    // Incrementar tokenVersion para invalidar todos os tokens existentes
    if (session?.userId) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { tokenVersion: { increment: 1 } },
      });
    }

    // Remover cookie de autenticação
    await destroySession();

    return NextResponse.json({
      message: 'Logout realizado com sucesso',
    });
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json(
      { message: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
}
