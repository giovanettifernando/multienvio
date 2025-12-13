/**
 * POST /api/admin/auth/heartbeat
 *
 * Endpoint de keepalive para manter sessão admin ativa.
 * Atualiza o cookie `last_activity` para evitar timeout por inatividade.
 *
 * IMPORTANTE: Valida tokenVersion para garantir que sessões revogadas
 * não continuem "vivas" no cliente.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminTokenFromRequest,
  adminVerify,
  ADMIN_AUTH_COOKIE_NAME,
} from '@/lib/auth/admin-session';
import { staffSessionCache } from '@/lib/cache';
import { requireValidOrigin } from '@/lib/api/csrf';

const LAST_ACTIVITY_COOKIE_NAME = 'last_activity_admin';

export async function POST(request: Request) {
  try {
    // CSRF Protection - validar Origin header
    const csrfError = requireValidOrigin(request as NextRequest);
    if (csrfError) return csrfError;

    // Obter token admin do cookie
    const token = getAdminTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: 'not_authenticated', reason: 'no_token' },
        { status: 401 }
      );
    }

    // Verificar JWT (sem validar tokenVersion aqui, faremos separadamente)
    const { payload, error: jwtError } = await adminVerify(token);

    if (jwtError || !payload) {
      // Limpar cookies inválidos
      const response = NextResponse.json(
        { error: jwtError || 'invalid_token', reason: 'jwt_invalid' },
        { status: 401 }
      );

      response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

      return response;
    }

    // FAIL-CLOSE: Validar tokenVersion no Redis
    const redisTokenVersion = await staffSessionCache.getTokenVersion(payload.staffId);

    if (redisTokenVersion === null) {
      // Sessão não existe no Redis - forçar logout
      const response = NextResponse.json(
        { error: 'session_expired', reason: 'no_session_in_redis' },
        { status: 401 }
      );

      response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

      return response;
    }

    if (redisTokenVersion !== payload.tokenVersion) {
      // Token revogado (logout em outro dispositivo ou troca de senha)
      const response = NextResponse.json(
        { error: 'token_revoked', reason: 'token_version_mismatch' },
        { status: 401 }
      );

      response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

      return response;
    }

    // Verificar status do usuário no Redis
    const session = await staffSessionCache.get(payload.staffId);
    if (!session || session.status !== 'ACTIVE') {
      const response = NextResponse.json(
        { error: 'user_inactive', reason: 'status_not_active' },
        { status: 401 }
      );

      response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

      return response;
    }

    // Sessão válida - atualizar cookie de atividade
    const response = NextResponse.json({
      ok: true,
      timestamp: Date.now(),
    });

    // Setar cookie last_activity com timestamp atual
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, Date.now().toString(), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('[ADMIN_HEARTBEAT] Error:', error);
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500 }
    );
  }
}
