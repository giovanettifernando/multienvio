/**
 * GET /api/auth/google/callback
 *
 * Handles Google OAuth callback for User and Collector authentication.
 * Creates/links accounts and establishes sessions based on context.
 */

import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { prisma } from '@/platform/db/db';
import { withApiHandlerResponse } from '@/platform/api/handler';
import {
  parseState,
  exchangeCodeForTokens,
  getUserInfo,
  type OAuthContext,
} from '@/modules/auth/application/google-oauth';
import {
  signTokenPair,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from '@/modules/auth/application/jwt-tokens';
import { getCachedRoleByName, sessionCache } from '@/platform/cache/cache';
import type { RequestLogger } from '@/platform/api/types';

// JWT secret for collector tokens - OBRIGATÓRIO, sem fallback
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  throw new Error('[SECURITY] JWT_SECRET não configurado. Esta variável é obrigatória.');
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

// Default redirect URLs
const DEFAULT_REDIRECTS: Record<OAuthContext, string> = {
  user: '/',
  collector: '/coletores',
};

// Error redirect URLs
const ERROR_REDIRECTS: Record<OAuthContext, string> = {
  user: '/auth/login',
  collector: '/coletores/login',
};

/**
 * Handle User OAuth callback
 */
async function handleUserCallback(
  googleId: string,
  email: string,
  name: string,
  logger: RequestLogger,
  picture?: string
): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  try {
    // Check if user exists with this googleId
    let user = await prisma.user.findUnique({
      where: { googleId },
      include: { role: true },
    });

    if (user) {
      // User exists with this Google account - update info and login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          avatarUrl: picture || user.avatarUrl,
        },
      });
      return { success: true, userId: user.id };
    }

    // Check if user exists with this email but no googleId (link account)
    user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (user) {
      // User exists with email - link Google account
      if (user.googleId && user.googleId !== googleId) {
        // Email already linked to a different Google account
        return {
          success: false,
          error: 'Este e-mail já está vinculado a outra conta Google',
        };
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          authProvider: user.authProvider === 'email' ? 'google' : user.authProvider,
          lastLoginAt: new Date(),
          avatarUrl: picture || user.avatarUrl,
          // If user registered via email but never verified, mark as verified
          emailVerified: true,
          emailVerifiedAt: user.emailVerifiedAt || new Date(),
          status: user.status === 'pending' ? 'active' : user.status,
        },
      });

      return { success: true, userId: user.id };
    }

    // New user - create account (role lookup com cache)
    const userRole = await getCachedRoleByName('user');

    if (!userRole) {
      logger.error('google_oauth_role_not_found');
      return { success: false, error: 'Erro de configuração do sistema' };
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        googleId,
        authProvider: 'google',
        avatarUrl: picture,
        status: 'active', // Auto-activate for Google auth
        emailVerified: true,
        emailVerifiedAt: new Date(),
        roleId: userRole.id,
      },
    });

    logger.info('google_oauth_user_created', { userId: newUser.id });
    return { success: true, userId: newUser.id };
  } catch (error) {
    logger.error('google_oauth_user_error', { err: error });
    return { success: false, error: 'Erro ao processar autenticação' };
  }
}

/**
 * Handle Collector OAuth callback
 * Note: Collectors must already exist (created via manual registration)
 */
async function handleCollectorCallback(
  googleId: string,
  email: string,
  logger: RequestLogger
): Promise<
  | { success: true; collector: { id: string; pfNome: string; pfEmail: string | null; pjRazaoSocial: string; pjCnpj: string; status: string } }
  | { success: false; error: string; code?: string }
> {
  try {
    // Check if collector exists with this googleId
    let collector = await prisma.collector.findUnique({
      where: { googleId },
    });

    if (collector) {
      // Collector exists with this Google account - verify status and login
      if (collector.status === 'BLOCKED') {
        return {
          success: false,
          error: 'Sua conta está bloqueada. Entre em contato com o suporte.',
          code: 'ACCOUNT_BLOCKED',
        };
      }

      return {
        success: true,
        collector: {
          id: collector.id,
          pfNome: collector.pfNome,
          pfEmail: collector.pfEmail,
          pjRazaoSocial: collector.pjRazaoSocial,
          pjCnpj: collector.pjCnpj,
          status: collector.status,
        },
      };
    }

    // Check if collector exists with this email but no googleId (link account)
    collector = await prisma.collector.findFirst({
      where: {
        pfEmail: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    if (collector) {
      // Collector exists with email - link Google account
      if (collector.googleId && collector.googleId !== googleId) {
        return {
          success: false,
          error: 'Este e-mail já está vinculado a outra conta Google',
          code: 'EMAIL_ALREADY_LINKED',
        };
      }

      // Check email verification and status
      if (!collector.pfEmailVerified) {
        // Auto-verify email since Google already verified it
        await prisma.collector.update({
          where: { id: collector.id },
          data: {
            pfEmailVerified: true,
            pfEmailVerifiedAt: new Date(),
          },
        });
      }

      if (collector.status === 'BLOCKED') {
        return {
          success: false,
          error: 'Sua conta está bloqueada. Entre em contato com o suporte.',
          code: 'ACCOUNT_BLOCKED',
        };
      }

      // Link Google account
      await prisma.collector.update({
        where: { id: collector.id },
        data: {
          googleId,
          authProvider: 'google',
        },
      });

      return {
        success: true,
        collector: {
          id: collector.id,
          pfNome: collector.pfNome,
          pfEmail: collector.pfEmail,
          pjRazaoSocial: collector.pjRazaoSocial,
          pjCnpj: collector.pjCnpj,
          status: collector.status,
        },
      };
    }

    // Collector not found - they must register first
    return {
      success: false,
      error: 'Coletor não encontrado. Faça o cadastro primeiro.',
      code: 'COLLECTOR_NOT_FOUND',
    };
  } catch (error) {
    logger.error('google_oauth_collector_error', { err: error });
    return { success: false, error: 'Erro ao processar autenticação' };
  }
}

/**
 * Create collector JWT token (cookie will be set on response)
 */
async function createCollectorToken(collector: {
  id: string;
  pfNome: string;
  pfEmail: string | null;
  pjRazaoSocial: string;
  status: string;
}): Promise<string> {
  return new SignJWT({
    coletorId: collector.id,
    pfEmail: collector.pfEmail,
    pfNome: collector.pfNome,
    pjRazaoSocial: collector.pjRazaoSocial,
    status: collector.status,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export const GET = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors from Google
  if (error) {
    logger.warn('google_oauth_google_error', { error, errorDesc: searchParams.get('error_description') });
    const errorDesc = searchParams.get('error_description');
    // Default to user login page on error
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorDesc || error)}`, req.url)
    );
  }

  // Validate required parameters
  if (!code || !stateParam) {
    logger.warn('google_oauth_missing_params', { hasCode: !!code, hasState: !!stateParam });
    return NextResponse.redirect(
      new URL('/auth/login?error=Parâmetros inválidos', req.url)
    );
  }

  // Parse state to get context
  const state = parseState(stateParam);
  if (!state) {
    logger.warn('google_oauth_invalid_state');
    return NextResponse.redirect(
      new URL('/auth/login?error=Estado inválido', req.url)
    );
  }

  const { context: oauthContext, redirectUrl } = state;
  const errorRedirect = ERROR_REDIRECTS[oauthContext];
  const successRedirect = redirectUrl || DEFAULT_REDIRECTS[oauthContext];

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user info from Google
    const googleUser = await getUserInfo(tokens.access_token);

    logger.debug('google_oauth_user_info', {
      googleId: googleUser.sub,
      context: oauthContext,
    });

    if (oauthContext === 'user') {
      // Handle User authentication
      const result = await handleUserCallback(
        googleUser.sub,
        googleUser.email,
        googleUser.name,
        logger,
        googleUser.picture
      );

      if (!result.success) {
        return NextResponse.redirect(
          new URL(`${errorRedirect}?error=${encodeURIComponent(result.error)}`, req.url)
        );
      }

      // Get user data for session
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        include: { role: true },
      });

      if (!user) {
        return NextResponse.redirect(
          new URL(`${errorRedirect}?error=Usuário não encontrado`, req.url)
        );
      }

      // Get tokenVersion from Redis (or init with 1)
      const tokenVersion = await sessionCache.getOrInitTokenVersion(user.id);

      // Create JWT token pair for session (access + refresh)
      const { accessToken, refreshToken } = await signTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role?.name || 'user',
        tokenVersion,
      });

      // Save session to Redis
      await sessionCache.set(user.id, {
        userId: user.id,
        email: user.email,
        role: user.role?.name || 'user',
        status: user.status,
        tokenVersion,
      });

      logger.info('google_oauth_user_session', { userId: user.id });

      // Create redirect response and set auth cookies
      const response = NextResponse.redirect(new URL(successRedirect, req.url));
      const isProduction = process.env.NODE_ENV === 'production';

      // Set access token cookie (15 min)
      response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
      });

      // Set refresh token cookie (7 days)
      response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
      });

      // Set last activity cookie
      response.cookies.set('last_activity_user', Date.now().toString(), {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      });

      return response;
    } else {
      // Handle Collector authentication
      const result = await handleCollectorCallback(googleUser.sub, googleUser.email, logger);

      if (!result.success) {
        const errorParams = new URLSearchParams({
          error: result.error,
          ...(result.code && { code: result.code }),
        });
        return NextResponse.redirect(
          new URL(`${errorRedirect}?${errorParams.toString()}`, req.url)
        );
      }

      // Create collector token
      const collectorToken = await createCollectorToken(result.collector);

      logger.info('google_oauth_collector_session', { collectorId: result.collector.id });

      // Create redirect response and set collector cookie directly on it
      const response = NextResponse.redirect(new URL(successRedirect, req.url));
      response.cookies.set('coletor-token', collectorToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return response;
    }
  } catch (error) {
    logger.error('google_oauth_callback_error', { err: error });
    const message = error instanceof Error ? error.message : 'Erro ao processar autenticação';
    return NextResponse.redirect(
      new URL(`${errorRedirect}?error=${encodeURIComponent(message)}`, req.url)
    );
  }
});
