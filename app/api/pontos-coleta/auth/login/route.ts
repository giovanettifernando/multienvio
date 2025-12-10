import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { collectorSign, createCollectorCookieHeader } from '@/lib/auth/collector-session';
import bcrypt from 'bcrypt';
import { withApiHandlerResponse } from '@/lib/api/handler';

const loginSchema = z.object({
  cnpj: z.string().min(14).max(14), // CNPJ apenas números
  password: z.string().min(1),
});

type LoginSuccessResponse = {
  message: string;
  collector: {
    pointId: string;
    cnpj: string;
    nomeFantasia: string;
  };
};

type LoginErrorResponse = {
  message: string;
  errors?: Record<string, unknown>;
};

export const POST = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  try {
    const body = await req.json();
    const { cnpj, password } = loginSchema.parse(body);

    logger.info('collector_login_attempt', { cnpj });

    // Buscar ponto de coleta pelo CNPJ
    const point = await prisma.pickupPoint.findUnique({
      where: { cnpj },
      select: {
        id: true,
        status: true,
        cnpj: true,
        nomeFantasia: true,
        passwordHash: true,
        tokenVersion: true,
      },
    });

    if (!point) {
      logger.warn('collector_login_not_found', { cnpj });
      return NextResponse.json<LoginErrorResponse>(
        { message: 'CNPJ ou senha inválidos' },
        { status: 401 }
      );
    }

    // Verificar se o ponto está ativo
    if (point.status !== 'ACTIVE') {
      logger.warn('collector_login_inactive', { pointId: point.id, status: point.status });
      return NextResponse.json<LoginErrorResponse>(
        { message: 'Ponto de coleta inativo ou bloqueado' },
        { status: 403 }
      );
    }

    // Verificar se tem senha configurada
    if (!point.passwordHash) {
      logger.warn('collector_login_no_password', { pointId: point.id });
      return NextResponse.json<LoginErrorResponse>(
        { message: 'Senha não configurada. Entre em contato com o suporte.' },
        { status: 403 }
      );
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, point.passwordHash);
    if (!isPasswordValid) {
      logger.warn('collector_login_invalid_password', { pointId: point.id });
      return NextResponse.json<LoginErrorResponse>(
        { message: 'CNPJ ou senha inválidos' },
        { status: 401 }
      );
    }

    // Gerar JWT token com tokenVersion para invalidação via logout
    const token = await collectorSign({
      pointId: point.id,
      cnpj: point.cnpj,
      nomeFantasia: point.nomeFantasia,
      tokenVersion: point.tokenVersion,
    });

    logger.info('collector_login_success', { pointId: point.id });

    // Criar response com cookie
    const response = NextResponse.json<LoginSuccessResponse>({
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
      logger.debug('collector_login_validation_error', { errors: error.flatten() });
      return NextResponse.json<LoginErrorResponse>(
        { message: 'Dados inválidos', errors: error.flatten() },
        { status: 400 }
      );
    }
    logger.error('collector_login_error', { err: error });
    return NextResponse.json<LoginErrorResponse>(
      { message: 'Erro ao realizar login' },
      { status: 500 }
    );
  }
});
