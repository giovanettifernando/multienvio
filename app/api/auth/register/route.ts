import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { RegisterSchema } from '@/lib/validation/auth';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { UserStatus } from '@/types/contracts';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = RegisterSchema.parse(payload);

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'E-mail já cadastrado' },
        { status: 409 }
      );
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Buscar role "user" padrão
    const userRole = await prisma.role.findUnique({
      where: { name: 'user' },
    });

    if (!userRole) {
      console.error('Role "user" não encontrada no banco');
      return NextResponse.json(
        { message: 'Erro ao criar usuário' },
        { status: 500 }
      );
    }

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone || null,
        status: UserStatus.ACTIVE,
        roleId: userRole.id,
      },
      include: {
        role: true,
      },
    });

    // Criar sessão automaticamente (auto-login após registro)
    await createSession({
      userId: user.id,
      email: user.email,
      role: user.role?.name || 'user',
    });

    return NextResponse.json(
      {
        userId: user.id,
        message: 'Usuário criado com sucesso',
      },
      { status: 201 }
    );
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

    console.error('Error creating user:', error);
    return NextResponse.json(
      { message: 'Não foi possível concluir o cadastro' },
      { status: 500 }
    );
  }
}
