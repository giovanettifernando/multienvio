/**
 * API Route para login de coletores autônomos
 * POST /api/coletores/auth/login - Autentica um coletor
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/platform/db/db';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { rateLimitByIP } from '@/platform/cache/rate-limit-redis';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { CollectorLoginSchema } from '@/shared/validation/auth';
import { collectorSessionCache } from '@/platform/cache/cache';

// Validar JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent token forgery.'
  );
}

// JWT Secret - Nunca usar fallbacks em produção
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

type CollectorLoginErrorResponse =
  | { code: 'VALIDATION_ERROR'; message: string; errors: Array<{ field: string; message: string }> }
  | { code: 'INVALID_CREDENTIALS'; message: string }
  | { code: 'EMAIL_NOT_VERIFIED'; message: string; collectorId: string }
  | { code: 'ACCOUNT_INACTIVE'; message: string }
  | { code: 'SERVER_ERROR'; message: string };

type CollectorLoginSuccessResponse = {
  message: string;
  coletor: {
    id: string;
    status: string;
    pfNome: string | null;
    pfEmail: string;
    pfCelular: string | null;
    pjRazaoSocial: string | null;
    pjCnpj: string | null;
  };
};

type CollectorLoginResponse = CollectorLoginSuccessResponse | CollectorLoginErrorResponse;

/**
 * POST /api/coletores/auth/login
 * Autentica coletor por e-mail e senha
 */
export const POST = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  try {
    // 🔒 SECURITY: Rate limiting para prevenir ataques de força bruta (Redis distribuido)
    const rateLimitResult = await rateLimitByIP(req as NextRequest, 'collector-login', {
      windowMs: 5 * 60 * 1000, // 5 minutos
      maxRequests: 5, // 5 tentativas
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const body = await req.json();

    // Validação com Zod
    const validation = CollectorLoginSchema.safeParse(body);
    if (!validation.success) {
      logger.warn('collector_login_validation_error', { errors: validation.error.flatten() });
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: validation.error.issues[0]?.message || 'Dados inválidos',
          errors: validation.error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // Find collector by email (case-insensitive)
    const collector = await prisma.collector.findFirst({
      where: {
        pfEmail: {
          equals: email,
          mode: 'insensitive',
        },
      },
      include: {
        credential: true,
      },
    });

    // Don't leak information about whether email exists
    if (!collector || !collector.credential) {
      logger.warn('collector_login_invalid_credentials');
      return NextResponse.json(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'E-mail ou senha inválidos'
        },
        { status: 401 }
      );
    }

    logger.debug('collector_login_found', { collectorId: collector.id });

    // Verify password
    const passwordMatch = await bcrypt.compare(password, collector.credential.passwordHash);

    if (!passwordMatch) {
      logger.warn('collector_login_wrong_password', { collectorId: collector.id });
      return NextResponse.json(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'E-mail ou senha inválidos'
        },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!collector.pfEmailVerified) {
      logger.warn('collector_login_email_not_verified', { collectorId: collector.id });
      return NextResponse.json(
        {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Confirme seu e-mail para continuar. Verifique sua caixa de entrada.',
          collectorId: collector.id,
        },
        { status: 403 }
      );
    }

    // Check if collector is active (ACTIVE or INACTIVE are allowed, BLOCKED is not)
    if (collector.status === 'BLOCKED') {
      logger.warn('collector_login_blocked', { collectorId: collector.id });
      return NextResponse.json(
        {
          code: 'ACCOUNT_INACTIVE',
          message: 'Sua conta está bloqueada. Entre em contato com o suporte.'
        },
        { status: 403 }
      );
    }

    if (collector.status === 'INACTIVE') {
      logger.info('collector_login_inactive', { collectorId: collector.id });
      return NextResponse.json(
        {
          code: 'ACCOUNT_INACTIVE',
          message: 'Sua conta está aguardando aprovação do administrador.'
        },
        { status: 403 }
      );
    }

    logger.info('collector_login_success', { collectorId: collector.id });

    // Obter tokenVersion do Redis (existente ou inicializa com 1)
    const tokenVersion = await collectorSessionCache.getOrInitTokenVersion(collector.id);

    // Create JWT token with tokenVersion for logout invalidation
    const token = await new SignJWT({
      coletorId: collector.id,
      pfEmail: collector.pfEmail,
      pfNome: collector.pfNome,
      pjRazaoSocial: collector.pjRazaoSocial,
      status: collector.status,
      tokenVersion,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    // Salvar sessão no Redis
    await collectorSessionCache.set(collector.id, {
      collectorId: collector.id,
      email: collector.pfEmail,
      name: collector.pfNome || collector.pjRazaoSocial || '',
      status: collector.status,
      tokenVersion,
    });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('coletor-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({
      message: 'Login realizado com sucesso',
      coletor: {
        id: collector.id,
        status: collector.status.toLowerCase(),
        pfNome: collector.pfNome,
        pfEmail: collector.pfEmail,
        pfCelular: collector.pfCelular,
        pjRazaoSocial: collector.pjRazaoSocial,
        pjCnpj: collector.pjCnpj,
      },
    });
  } catch (error) {
    logger.error('collector_login_error', { err: error });
    return NextResponse.json(
      {
        code: 'SERVER_ERROR',
        message: 'Erro ao fazer login. Tente novamente mais tarde.',
      },
      { status: 500 }
    );
  }
});
