import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { AdminPermission } from '@prisma/client';
import type { FinanceSummary } from '@/lib/admin/finance/types';

export const GET = withApiHandler<FinanceSummary>(async ({ req }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  if (!session.permissions.includes(AdminPermission.FINANCEIRO)) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para acessar finanças',
      status: 403,
    });
  }

  const searchParams = req.nextUrl.searchParams;
  const dateStart = searchParams.get('dateStart') || undefined;
  const dateEnd = searchParams.get('dateEnd') || undefined;

  // Mock data
  const summary: FinanceSummary = {
    period: { dateStart, dateEnd },
    grossRevenue: 850000.0,
    platformFees: 42500.0,
    carrierPayouts: 650000.0,
    partnerCommissions: 25000.0,
    refunds: 12000.0,
    chargebacks: 3500.0,
    customersWalletBalance: 180000.0,
    platformOperationalBalance: 117000.0,
  };

  return { data: summary };
});
