import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/lib/api/handler';
import { getAdminSessionFromRequest, createAdminCookieRemovalHeader } from '@/lib/auth/admin-session';
import { prisma } from '@/lib/db';

type AdminLogoutResponse = {
  message: string;
};

export const POST = withApiHandlerResponse<Record<string, never>>(async (context) => {
  const { req, logger } = context;

  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  try {
    // Increment tokenVersion to invalidate all existing tokens for this user
    await prisma.staffUser.update({
      where: { id: session.staffId },
      data: {
        tokenVersion: { increment: 1 },
      },
    });

    logger.info('admin_logout_success', { staffId: session.staffId });

    // Create response with cookie removal header
    const response = NextResponse.json({
      message: 'Logout realizado com sucesso',
    });

    // Remove admin auth cookie
    response.headers.set('Set-Cookie', createAdminCookieRemovalHeader());

    return response;
  } catch (error) {
    logger.error('admin_logout_error', { err: error });
    return NextResponse.json(
      { message: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
});
