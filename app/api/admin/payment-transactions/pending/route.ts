/**
 * GET /api/admin/payment-transactions/pending
 *
 * Lista todos os pagamentos pendentes de aprovação
 */

import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';

export const GET = withApiHandler(async ({ req }) => {
  const authResult = await requireAdminUser(req, AdminPermission.INTEGRACOES);
  if (authResult instanceof Response) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  // Buscar pagamentos pendentes
  const payments = await prisma.paymentTransaction.findMany({
    where: {
      status: 'PENDING',
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100, // Limite de 100 registros
  });

  return {
    data: {
      payments,
      total: payments.length,
    },
  };
});
