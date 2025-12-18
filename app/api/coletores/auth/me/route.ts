/**
 * API Route para verificar sessão de coletor autônomo
 * GET /api/coletores/auth/me - Retorna dados do coletor autenticado
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';

// Validar JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    'SECURITY ERROR: JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent token forgery.'
  );
}

// JWT Secret - Nunca usar fallbacks em produção
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

type CollectorMeResponse = {
  coletor: {
    id: string;
    status: string;
    pfNome: string | null;
    pfEmail: string | null;
    pfCelular: string | null;
    pjRazaoSocial: string | null;
    pjCnpj: string | null;
  };
};

/**
 * GET /api/coletores/auth/me
 * Verifica autenticação e retorna dados do coletor
 */
export const GET = withApiHandler<CollectorMeResponse>(async (context) => {
  const { logger } = context;

  const cookieStore = await cookies();
  const token = cookieStore.get('coletor-token');

  if (!token) {
    throw new ApiError({
      code: 'unauthorized',
      message: 'Não autenticado',
      status: 401,
    });
  }

  try {
    // Verify JWT token
    const { payload } = await jwtVerify(token.value, JWT_SECRET);

    // Get fresh data from database
    const collector = await prisma.collector.findUnique({
      where: {
        id: payload.coletorId as string,
      },
    });

    if (!collector) {
      throw new ApiError({
        code: 'not_found',
        message: 'Coletor não encontrado',
        status: 404,
      });
    }

    // Check if still active
    if (collector.status !== 'ACTIVE') {
      throw new ApiError({
        code: 'forbidden',
        message: 'Cadastro não está ativo',
        status: 403,
      });
    }

    logger.info('coletor_me_success', { collectorId: collector.id });

    return {
      data: {
        coletor: {
          id: collector.id,
          status: collector.status.toLowerCase(),
          pfNome: collector.pfNome,
          pfEmail: collector.pfEmail,
          pfCelular: collector.pfCelular,
          pjRazaoSocial: collector.pjRazaoSocial,
          pjCnpj: collector.pjCnpj,
        },
      },
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error('coletor_me_error', { err: error });
    throw new ApiError({
      code: 'unauthorized',
      message: 'Sessão inválida',
      status: 401,
    });
  }
});
