import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/platform/db/db';
import { collectorSign, createCollectorCookieHeader } from '@/modules/auth/application/collector-session';
import bcrypt from 'bcrypt';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { rateLimitByIP, RATE_LIMITS } from '@/platform/cache/rate-limit-redis';
import { pickupPointSessionCache } from '@/platform/cache/cache';

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

  // Rate limiting by IP - 5 attempts per 5 minutes (same as login)
  const rateLimitError = await rateLimitByIP(req as NextRequest, 'pickup_point_login', RATE_LIMITS.LOGIN);
  if (rateLimitError) return rateLimitError;

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

    // Obter tokenVersion do Redis (existente ou inicializa com 1)
    const tokenVersion = await pickupPointSessionCache.getOrInitTokenVersion(point.id);

    // Gerar JWT token com tokenVersion para invalidação via logout
    const token = await collectorSign({
      pointId: point.id,
      cnpj: point.cnpj,
      nomeFantasia: point.nomeFantasia,
      tokenVersion,
    });

    // Salvar sessão no Redis
    await pickupPointSessionCache.set(point.id, {
      pointId: point.id,
      cnpj: point.cnpj,
      nomeFantasia: point.nomeFantasia,
      status: point.status,
      tokenVersion,
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
