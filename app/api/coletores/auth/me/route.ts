/**
 * API Route para verificar sessão de coletor autônomo
 * GET /api/coletores/auth/me - Retorna dados do coletor autenticado
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireCollectorSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

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

  const session = await requireCollectorSession();

  // Get fresh data from database
  const collector = await prisma.collector.findUnique({
    where: {
      id: session.coletorId,
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
});
