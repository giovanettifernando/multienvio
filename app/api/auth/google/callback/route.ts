/**
 * GET /api/auth/google/callback
 *
 * Handles Google OAuth callback for User and Collector authentication.
 * Creates/links accounts and establishes sessions based on context.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import {
  parseState,
  exchangeCodeForTokens,
  getUserInfo,
  type OAuthContext,
} from '@/lib/auth/google-oauth';
import { createSession } from '@/lib/auth/session';

// JWT secret for collector tokens
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

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

    // New user - create account
    const userRole = await prisma.role.findUnique({
      where: { name: 'user' },
    });

    if (!userRole) {
      console.error('[GOOGLE_OAUTH] Default role "user" not found');
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

    console.log('[GOOGLE_OAUTH] New user created:', newUser.id);
    return { success: true, userId: newUser.id };
  } catch (error) {
    console.error('[GOOGLE_OAUTH] User callback error:', error);
    return { success: false, error: 'Erro ao processar autenticação' };
  }
}

/**
 * Handle Collector OAuth callback
 * Note: Collectors must already exist (created via manual registration)
 */
async function handleCollectorCallback(
  googleId: string,
  email: string
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
    console.error('[GOOGLE_OAUTH] Collector callback error:', error);
    return { success: false, error: 'Erro ao processar autenticação' };
  }
}

/**
 * Create collector JWT session
 */
async function createCollectorSession(collector: {
  id: string;
  pfNome: string;
  pfEmail: string | null;
  pjRazaoSocial: string;
  status: string;
}): Promise<void> {
  const token = await new SignJWT({
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

  const cookieStore = await cookies();
  cookieStore.set('coletor-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors from Google
  if (error) {
    console.error('[GOOGLE_OAUTH] Error from Google:', error);
    const errorDesc = searchParams.get('error_description');
    // Default to user login page on error
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorDesc || error)}`, request.url)
    );
  }

  // Validate required parameters
  if (!code || !stateParam) {
    console.error('[GOOGLE_OAUTH] Missing code or state parameter');
    return NextResponse.redirect(
      new URL('/auth/login?error=Parâmetros inválidos', request.url)
    );
  }

  // Parse state to get context
  const state = parseState(stateParam);
  if (!state) {
    console.error('[GOOGLE_OAUTH] Invalid state parameter');
    return NextResponse.redirect(
      new URL('/auth/login?error=Estado inválido', request.url)
    );
  }

  const { context, redirectUrl } = state;
  const errorRedirect = ERROR_REDIRECTS[context];
  const successRedirect = redirectUrl || DEFAULT_REDIRECTS[context];

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user info from Google
    const googleUser = await getUserInfo(tokens.access_token);

    console.log('[GOOGLE_OAUTH] Got user info:', {
      sub: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      context,
    });

    if (context === 'user') {
      // Handle User authentication
      const result = await handleUserCallback(
        googleUser.sub,
        googleUser.email,
        googleUser.name,
        googleUser.picture
      );

      if (!result.success) {
        return NextResponse.redirect(
          new URL(`${errorRedirect}?error=${encodeURIComponent(result.error)}`, request.url)
        );
      }

      // Get user data for session
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        include: { role: true },
      });

      if (!user) {
        return NextResponse.redirect(
          new URL(`${errorRedirect}?error=Usuário não encontrado`, request.url)
        );
      }

      // Create session
      await createSession({
        userId: user.id,
        email: user.email,
        role: user.role?.name || 'user',
        tokenVersion: user.tokenVersion,
      });

      console.log('[GOOGLE_OAUTH] User session created:', user.id);
      return NextResponse.redirect(new URL(successRedirect, request.url));
    } else {
      // Handle Collector authentication
      const result = await handleCollectorCallback(googleUser.sub, googleUser.email);

      if (!result.success) {
        const errorParams = new URLSearchParams({
          error: result.error,
          ...(result.code && { code: result.code }),
        });
        return NextResponse.redirect(
          new URL(`${errorRedirect}?${errorParams.toString()}`, request.url)
        );
      }

      // Create collector session
      await createCollectorSession(result.collector);

      console.log('[GOOGLE_OAUTH] Collector session created:', result.collector.id);
      return NextResponse.redirect(new URL(successRedirect, request.url));
    }
  } catch (error) {
    console.error('[GOOGLE_OAUTH] Callback error:', error);
    const message = error instanceof Error ? error.message : 'Erro ao processar autenticação';
    return NextResponse.redirect(
      new URL(`${errorRedirect}?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
