import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { withApiHandlerResponse } from '@/lib/api/handler';
import { LoginSchema } from '@/lib/validation/auth';
import { prisma } from '@/lib/db';
import {
  signTokenPair,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from '@/lib/auth/jwt-tokens';
import { UserStatus, AuthRole, type User } from '@/types/contracts';
import { rateLimitByIPStrict, RATE_LIMITS } from '@/lib/rate-limit-redis';
import { sessionCache } from '@/lib/cache';

export const POST = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  // Rate limiting by IP - STRICT (fail-close) - 5 attempts per 5 minutes
  // Se Redis indisponível, retorna 503 ao invés de permitir acesso
  const rateLimitError = await rateLimitByIPStrict(req as NextRequest, 'client_login', RATE_LIMITS.LOGIN);
  if (rateLimitError) return rateLimitError;

  try {
    const payload = await req.json();
    const data = LoginSchema.parse(payload);

    logger.info('login_attempt', { email: data.email });

    // Buscar usuário por email com role
    const dbUser = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        role: true,
      },
    });

    // Mensagem genérica para não revelar se email existe
    if (!dbUser || !dbUser.passwordHash) {
      logger.warn('login_failed', { reason: 'invalid_credentials' });
      return NextResponse.json(
        { message: 'E-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    // Verificar senha
    const passwordValid = await bcrypt.compare(data.password, dbUser.passwordHash);

    if (!passwordValid) {
      logger.warn('login_failed', { reason: 'invalid_password', userId: dbUser.id });
      return NextResponse.json(
        { message: 'E-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    // Verificar se o email foi verificado
    if (!dbUser.emailVerified) {
      logger.warn('login_failed', { reason: 'email_not_verified', userId: dbUser.id });
      return NextResponse.json(
        {
          message: 'Email não verificado. Verifique sua caixa de entrada para ativar sua conta.',
          code: 'EMAIL_NOT_VERIFIED'
        },
        { status: 403 }
      );
    }

    // Verificar status do usuário
    if (dbUser.status !== UserStatus.ACTIVE) {
      logger.warn('login_failed', { reason: 'inactive_account', userId: dbUser.id, status: dbUser.status });
      return NextResponse.json(
        { message: 'Conta inativa ou bloqueada' },
        { status: 403 }
      );
    }

    // Atualizar lastLoginAt
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { lastLoginAt: new Date() },
    });

    // Obter tokenVersion do Redis (existente ou inicializa com 1)
    const tokenVersion = await sessionCache.getOrInitTokenVersion(dbUser.id);

    // Criar par de tokens JWT (access + refresh)
    const { accessToken, refreshToken } = await signTokenPair({
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role?.name || 'user',
      tokenVersion,
    });

    // Salvar sessão completa no Redis
    await sessionCache.set(dbUser.id, {
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role?.name || 'user',
      status: dbUser.status,
      tokenVersion,
    });

    // Mapear para o tipo User global (sem expor passwordHash)
    const user: User = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      avatarUrl: dbUser.avatarUrl,
      status: dbUser.status as UserStatus,
      roles: dbUser.role?.name === 'admin' ? [AuthRole.ADMIN] : [],
      lastLoginAt: dbUser.lastLoginAt?.toISOString() || null,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    };

    logger.info('login_success', { userId: dbUser.id });

    // Criar resposta JSON
    const response = NextResponse.json({
      user,
      message: 'Login realizado com sucesso',
    });

    // Set auth cookies directly on the response
    // NOTE: cookies() API doesn't work with custom NextResponse - must set on response object
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token (curta duração - 15min)
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    });

    // Refresh token (longa duração - 7 dias)
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    });

    // Reset last_activity cookie para evitar timeout de inatividade logo após login
    response.cookies.set('last_activity', Date.now().toString(), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 422 }
      );
    }

    logger.error('login_error', { err: error });
    return NextResponse.json(
      { message: 'Não foi possível realizar o login' },
      { status: 500 }
    );
  }
});
