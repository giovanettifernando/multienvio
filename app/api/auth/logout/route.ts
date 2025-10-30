import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
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
