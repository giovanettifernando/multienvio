export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createCollectorCookieRemovalHeader } from '@/lib/auth/collector-session';

export async function POST() {
  try {
    const response = NextResponse.json({
      message: 'Logout realizado com sucesso',
    });

    response.headers.set('Set-Cookie', createCollectorCookieRemovalHeader());

    return response;
  } catch (error) {
    console.error('[COLLECTOR_LOGOUT]', error);
    return NextResponse.json(
      { message: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
}
