/**
 * API Route para logout de coletores autônomos
 * POST /api/coletores/auth/logout - Faz logout do coletor
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST /api/coletores/auth/logout
 * Remove cookie de autenticação
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('coletor-token');

    return NextResponse.json({
      message: 'Logout realizado com sucesso',
    });
  } catch (error) {
    console.error('[POST /api/coletores/auth/logout] Error:', error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Erro ao fazer logout',
      },
      { status: 500 }
    );
  }
}
