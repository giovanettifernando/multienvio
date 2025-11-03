import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { LoginSchema } from '@/lib/validation/auth';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { UserStatus, AuthRole, type User } from '@/types/contracts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('[LOGIN] Request payload:', { email: payload.email });
    const data = LoginSchema.parse(payload);

    console.log('[LOGIN] Searching for user with email:', data.email);
    // Buscar usuário por email com role (sempre buscar do banco, sem cache)
    const dbUser = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        role: true,
      },
    });

    console.log('[LOGIN] Query result - User found:', !!dbUser);
    console.log('[LOGIN] User email:', dbUser?.email);
    console.log('[LOGIN] User ID:', dbUser?.id);
    console.log('[LOGIN] Password hash exists:', !!dbUser?.passwordHash);
    console.log('[LOGIN] Password hash in DB:', dbUser?.passwordHash?.substring(0, 20) + '...');
    console.log('[LOGIN] Password hash length:', dbUser?.passwordHash?.length);
    console.log('[LOGIN] TokenVersion:', dbUser?.tokenVersion);
    console.log('[LOGIN] PasswordUpdatedAt:', dbUser?.passwordUpdatedAt);

    // Mensagem genérica para não revelar se email existe
    if (!dbUser || !dbUser.passwordHash) {
      console.log('[LOGIN] User not found or no password hash');
      return NextResponse.json(
        { message: 'E-mail ou senha inválidos' },
        { status: 401 }
      );
    }

    // Verificar senha
    console.log('[LOGIN] Comparing password...');
    const passwordValid = await bcrypt.compare(data.password, dbUser.passwordHash);
    console.log('[LOGIN] Password valid:', passwordValid);

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
      status: dbUser.status as UserStatus,
      roles: dbUser.role?.name === 'admin' ? [AuthRole.ADMIN] : [],
      lastLoginAt: dbUser.lastLoginAt?.toISOString() || null,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    };

    return NextResponse.json({
      user,
      message: 'Login realizado com sucesso',
    });
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
