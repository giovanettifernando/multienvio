import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { destroySession, getSession } from '@/modules/auth/application/session';
import { sessionCache, userCache } from '@/platform/cache/cache';
import { verifyRefreshToken, REFRESH_TOKEN_COOKIE } from '@/modules/auth/application/jwt-tokens';
import { requireValidOrigin } from '@/platform/api/csrf';

/**
 * POST /api/auth/logout
 *
 * Logout resiliente: sempre revoga a sessão, mesmo se access token expirado.
 * Fluxo:
 * 1. Tenta obter userId do access token (getSession)
 * 2. Se falhar, tenta obter do refresh token (válido por 7 dias)
 * 3. Com userId, incrementa tokenVersion para invalidar todos os tokens
 * 4. Limpa cookies e cache
 */
export const POST = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  // CSRF Protection - validar Origin header
  const csrfError = requireValidOrigin(req as NextRequest);
  if (csrfError) return csrfError;

  try {
    let userId: string | null = null;

    // 1. Tentar obter userId do access token (via getSession)
    const session = await getSession();
    if (session?.userId) {
      userId = session.userId;
      logger.debug('logout_from_access_token', { userId });
    }

    // 2. Se access token falhou, tentar refresh token (válido por 7 dias)
    if (!userId) {
      const cookieStore = await cookies();
      const refreshTokenCookie = cookieStore.get(REFRESH_TOKEN_COOKIE);

      if (refreshTokenCookie?.value) {
        // Validar refresh token (sem verificar tokenVersion para garantir revogação)
        const { payload, error } = await verifyRefreshToken(
          refreshTokenCookie.value,
          false // skipTokenVersionCheck - queremos revogar mesmo se já revogado
        );

        if (!error && payload?.userId) {
          userId = payload.userId;
          logger.debug('logout_from_refresh_token', { userId });
        } else {
          logger.debug('logout_refresh_token_invalid', { error });
        }
      }
    }

    // 3. Com userId, revogar sessão
    if (userId) {
      // INCR tokenVersion no Redis - invalida todos os tokens existentes
      const newVersion = await sessionCache.incrementTokenVersion(userId);

      // Invalidar cache de dados do usuário
      userCache.invalidate(userId).catch(() => {});

      logger.info('logout_success', { userId, newTokenVersion: newVersion });
    } else {
      // Nenhum token válido - apenas limpar cookies
      logger.info('logout_no_valid_token');
    }

    // 4. Sempre remover cookies de autenticação
    await destroySession();

    return NextResponse.json({
      message: 'Logout realizado com sucesso',
    });
  } catch (error) {
    logger.error('logout_error', { err: error });
    return NextResponse.json(
      { message: 'Erro ao realizar logout' },
      { status: 500 }
    );
  }
});
