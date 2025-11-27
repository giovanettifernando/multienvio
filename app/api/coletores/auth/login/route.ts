/**
 * API Route para login de coletores autônomos
 * POST /api/coletores/auth/login - Autentica um coletor
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { rateLimitByIP } from '@/lib/rate-limit';

// Validar JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent token forgery.'
  );
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

/**
 * POST /api/coletores/auth/login
 * Autentica coletor por e-mail e senha
 */
export async function POST(request: NextRequest) {
  try {
    // 🔒 SECURITY: Rate limiting para prevenir ataques de força bruta
    const rateLimitResult = rateLimitByIP(request, 'collector-login', {
      windowMs: 5 * 60 * 1000, // 5 minutos
      maxRequests: 5, // 5 tentativas
    });

    if (rateLimitResult) {
      return rateLimitResult;
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      console.warn('[login] MISSING_CREDENTIALS: Email or password missing');
      return NextResponse.json(
        { message: 'E-mail e senha são obrigatórios' },
        { status: 400 }
      );
    }

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
      console.warn('[login] INVALID_CREDENTIALS: Collector not found or no credentials for email:', email.substring(0, 3) + '***');
      return NextResponse.json(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'E-mail ou senha inválidos'
        },
        { status: 401 }
      );
    }

    console.info('[login] COLLECTOR_FOUND: ID', collector.id, 'for email:', email.substring(0, 3) + '***');

    // Verify password
    const passwordMatch = await bcrypt.compare(password, collector.credential.passwordHash);

    if (!passwordMatch) {
      console.warn('[login] INVALID_CREDENTIALS: Wrong password for collector ID:', collector.id);
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
      console.warn('[login] EMAIL_NOT_VERIFIED: Collector ID:', collector.id, '- Email not verified');
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
      console.warn('[login] ACCOUNT_BLOCKED: Collector ID:', collector.id, '- Status:', collector.status);
      return NextResponse.json(
        {
          code: 'ACCOUNT_INACTIVE',
          message: 'Sua conta está bloqueada. Entre em contato com o suporte.'
        },
        { status: 403 }
      );
    }

    if (collector.status === 'INACTIVE') {
      console.info('[login] ACCOUNT_INACTIVE: Collector ID:', collector.id, '- Awaiting admin approval');
      return NextResponse.json(
        {
          code: 'ACCOUNT_INACTIVE',
          message: 'Sua conta está aguardando aprovação do administrador.'
        },
        { status: 403 }
      );
    }

    console.info('[login] LOGIN_SUCCESS: Collector ID:', collector.id, '(', collector.pfNome, ') logged in successfully');

    // Create JWT token with tokenVersion for logout invalidation
    const token = await new SignJWT({
      coletorId: collector.id,
      pfEmail: collector.pfEmail,
      pfNome: collector.pfNome,
      pjRazaoSocial: collector.pjRazaoSocial,
      status: collector.status,
      tokenVersion: collector.tokenVersion,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

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
    console.error('[login] SERVER_ERROR:', error);
    return NextResponse.json(
      {
        code: 'SERVER_ERROR',
        message: 'Erro ao fazer login. Tente novamente mais tarde.',
      },
      { status: 500 }
    );
  }
}
