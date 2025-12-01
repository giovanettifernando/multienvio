
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest, createAdminCookieRemovalHeader } from '@/lib/auth/admin-session';

export async function POST(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  try {
    // Increment tokenVersion to invalidate all existing tokens for this user
    const { prisma } = await import('@/lib/db');
    await prisma.staffUser.update({
      where: { id: session.staffId },
      data: {
        tokenVersion: { increment: 1 },
      },
    });

    console.log('[ADMIN_LOGOUT] Token version incremented for user:', session.staffId);

    // Create response with cookie removal header
    const response = NextResponse.json({
      message: 'Logout realizado com sucesso',
    });

    // Remove admin auth cookie
    response.headers.set('Set-Cookie', createAdminCookieRemovalHeader());

    return response;
  } catch (error) {
    console.error('[ADMIN_LOGOUT_ERROR]', error);
    return NextResponse.json(
      { message: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
}
