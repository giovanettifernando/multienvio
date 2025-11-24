export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { collectorSign, createCollectorCookieHeader } from '@/lib/auth/collector-session';
import bcrypt from 'bcrypt';

const loginSchema = z.object({
  cnpj: z.string().min(14).max(14), // CNPJ apenas números
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cnpj, password } = loginSchema.parse(body);

    // Buscar ponto de coleta pelo CNPJ
    const point = await prisma.pickupPoint.findUnique({
      where: { cnpj },
      select: {
        id: true,
        status: true,
        cnpj: true,
        nomeFantasia: true,
        passwordHash: true,
      },
    });

    if (!point) {
      return NextResponse.json(
        { message: 'CNPJ ou senha inválidos' },
        { status: 401 }
      );
    }

    // Verificar se o ponto está ativo
    if (point.status !== 'ACTIVE') {
      return NextResponse.json(
        { message: 'Ponto de coleta inativo ou bloqueado' },
        { status: 403 }
      );
    }

    // Verificar se tem senha configurada
    if (!point.passwordHash) {
      return NextResponse.json(
        { message: 'Senha não configurada. Entre em contato com o suporte.' },
        { status: 403 }
      );
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, point.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'CNPJ ou senha inválidos' },
        { status: 401 }
      );
    }

    // Gerar JWT token
    const token = await collectorSign({
      pointId: point.id,
      cnpj: point.cnpj,
      nomeFantasia: point.nomeFantasia,
    });

    // Criar response com cookie
    const response = NextResponse.json({
      message: 'Login realizado com sucesso',
      collector: {
        pointId: point.id,
        cnpj: point.cnpj,
        nomeFantasia: point.nomeFantasia,
      },
    });

    response.headers.set('Set-Cookie', createCollectorCookieHeader(token));

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Dados inválidos', errors: error.flatten() },
        { status: 400 }
      );
    }
    console.error('[COLLECTOR_LOGIN]', error);
    return NextResponse.json(
      { message: 'Erro ao realizar login' },
      { status: 500 }
    );
  }
}
