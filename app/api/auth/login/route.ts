import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcrypt';
import { LoginSchema } from '@/lib/validation/auth';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { UserStatus, AuthRole, type User } from '@/types/contracts';
import { rateLimitByIP, RATE_LIMITS } from '@/lib/rate-limit';


export async function POST(request: Request) {
  // Rate limiting by IP - 5 attempts per 5 minutes
  const rateLimitError = rateLimitByIP(request as NextRequest, 'client_login', RATE_LIMITS.LOGIN);
  if (rateLimitError) return rateLimitError;

  try {
    const payload = await request.json();
    const data = LoginSchema.parse(payload);

    // Buscar usuário por email com role (sempre buscar do banco, sem cache)
    const dbUser = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        role: true,
      },
    });

    // Mensagem genérica para não revelar se email existe
    if (!dbUser || !dbUser.passwordHash) {
      return NextResponse.json(
        { message: 'E-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    // Verificar senha
    const passwordValid = await bcrypt.compare(data.password, dbUser.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { message: 'E-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    // Verificar se o email foi verificado
    if (!dbUser.emailVerified) {
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

    // Criar sessão (JWT + cookie) com tokenVersion
    await createSession({
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role?.name || 'user',
      tokenVersion: dbUser.tokenVersion,
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

    // Criar resposta com cookie de atividade resetado
    const response = NextResponse.json({
      user,
      message: 'Login realizado com sucesso',
    });

    // Reset last_activity cookie para evitar timeout de inatividade logo após login
    response.cookies.set('last_activity', Date.now().toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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

    console.error('Error during login:', error);
    return NextResponse.json(
      { message: 'Não foi possível realizar o login' },
      { status: 500 }
    );
  }
}
