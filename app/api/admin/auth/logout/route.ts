// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createAdminCookieRemovalHeader } from '@/lib/auth/admin-session';

export async function POST() {
  try {
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
