/**
 * POST /api/admin/auth/refresh
 *
 * Renova o token JWT admin mantendo a sessão ativa.
 * - Valida token atual do cookie
 * - Verifica tokenVersion no Redis (fail-closed)
 * - Gera novo token com mesmo tokenVersion
 * - Renova TTL da sessão no Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminTokenFromRequest,
  adminVerify,
  adminSign,
  ADMIN_AUTH_COOKIE_NAME,
  createAdminCookieHeader,
} from '@/modules/auth/application/admin-session';
import { staffSessionCache } from '@/platform/cache/cache';
import { requireValidOrigin } from '@/platform/api/csrf';

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
        { error: 'not_authenticated', message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar JWT
    const { payload, error: jwtError } = await adminVerify(token);

    if (jwtError || !payload) {
      // Limpar cookies inválidos
      const response = NextResponse.json(
        { error: jwtError || 'invalid_token', message: 'Sessão inválida' },
        { status: 401 }
      );

      response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

      return response;
    }

    // FAIL-CLOSE: Verificar tokenVersion no Redis
    const redisTokenVersion = await staffSessionCache.getTokenVersion(payload.staffId);

    if (redisTokenVersion === null) {
      // Sessão não existe no Redis
      const response = NextResponse.json(
        { error: 'session_expired', message: 'Sessão expirada. Faça login novamente.' },
        { status: 401 }
      );

      response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

      return response;
    }

    if (redisTokenVersion !== payload.tokenVersion) {
      // Token revogado
      const response = NextResponse.json(
        { error: 'token_revoked', message: 'Sessão invalidada. Faça login novamente.' },
        { status: 401 }
      );

      response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

      return response;
    }

    // Verificar sessão e status do usuário no Redis
    const session = await staffSessionCache.get(payload.staffId);
    if (!session) {
      const response = NextResponse.json(
        { error: 'session_not_found', message: 'Sessão expirada. Faça login novamente.' },
        { status: 401 }
      );

      response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

      return response;
    }

    if (session.status !== 'ACTIVE') {
      const response = NextResponse.json(
        { error: 'user_inactive', message: 'Conta inativa ou bloqueada' },
        { status: 401 }
      );

      response.cookies.set(ADMIN_AUTH_COOKIE_NAME, '', { maxAge: 0, path: '/' });
      response.cookies.set(LAST_ACTIVITY_COOKIE_NAME, '', { maxAge: 0, path: '/' });

      return response;
    }

    // Gerar novo token com mesmo tokenVersion
    const newToken = await adminSign({
      staffId: payload.staffId,
      email: payload.email,
      role: payload.role,
      isSuperAdmin: payload.isSuperAdmin,
      permissions: payload.permissions,
      tokenVersion: redisTokenVersion,
    });

    // Renovar TTL da sessão no Redis (janela deslizante)
    await staffSessionCache.set(payload.staffId, {
      staffId: session.staffId,
      email: session.email,
      role: session.role,
      status: session.status,
      tokenVersion: redisTokenVersion,
    });

    // Criar resposta com novo token
    const response = NextResponse.json({
      message: 'Token renovado com sucesso',
    });

    // Setar novo cookie de autenticação
    response.headers.set('Set-Cookie', createAdminCookieHeader(newToken));

    // Atualizar cookie de atividade
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
    console.error('[ADMIN_REFRESH] Error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao renovar sessão' },
      { status: 500 }
    );
  }
}
