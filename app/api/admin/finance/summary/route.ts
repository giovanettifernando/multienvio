import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getAdminSessionFromRequest } from '@/modules/auth/application/admin-session';
import { prisma } from '@/platform/db/db';
import { AdminPermission, WalletTxType, WalletTxStatus } from '@prisma/client';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import type { FinanceSummary } from '@/modules/admin/application/finance/types';
import { startOfDayBrasilia, endOfDayBrasilia } from '@/shared/utils/date';

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

  // Construir filtro de data em UTC-3 (Brasília)
  const dateFilter = {
    ...(dateStart && { gte: startOfDayBrasilia(dateStart) }),
    ...(dateEnd && { lte: endOfDayBrasilia(dateEnd) }),
  };
  const hasDateFilter = dateStart || dateEnd;

  // 1. Receita bruta: soma de TOPUPs confirmados (recargas de carteira)
  const topupResult = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: {
      type: WalletTxType.TOPUP,
      status: WalletTxStatus.CONFIRMED,
      ...(hasDateFilter && { createdAt: dateFilter }),
    },
  });
  const grossRevenue = topupResult._sum.amountCents || 0;

  // 2. Taxas da plataforma: comissões sobre frete e coleta (usando postedAt como competência)
  const platformFeesResult = await prisma.shipment.aggregate({
    _sum: {
      platformShippingCommissionCents: true,
      platformPickupCommissionCents: true,
    },
    where: {
      status: { in: [ShipmentStatus.RECEIVED_AT_ORIGIN_HUB, ShipmentStatus.IN_TRANSIT_TO_DESTINATION, ShipmentStatus.DELIVERED] },
      postedAt: { not: null },
      ...(hasDateFilter && { postedAt: dateFilter }),
    },
  });
  const platformFees =
    (platformFeesResult._sum.platformShippingCommissionCents || 0) +
    (platformFeesResult._sum.platformPickupCommissionCents || 0);

  // 3. Repasses às transportadoras: soma de carrierQuotePrice dos pacotes (usando postedAt do shipment)
  const carrierPayoutsResult = await prisma.package.aggregate({
    _sum: { carrierQuotePrice: true },
    where: {
      shipment: {
        status: { in: [ShipmentStatus.RECEIVED_AT_ORIGIN_HUB, ShipmentStatus.IN_TRANSIT_TO_DESTINATION, ShipmentStatus.DELIVERED] },
        postedAt: { not: null },
        ...(hasDateFilter && { postedAt: dateFilter }),
      },
    },
  });
  // carrierQuotePrice está em reais (Float), converter para centavos
  const carrierPayouts = Math.round((carrierPayoutsResult._sum.carrierQuotePrice || 0) * 100);

  // 4. Comissões de parceiros (coletores): soma de pickupFee dos shipments postados
  const partnerCommissionsResult = await prisma.shipment.aggregate({
    _sum: { pickupFee: true },
    where: {
      status: { in: [ShipmentStatus.RECEIVED_AT_ORIGIN_HUB, ShipmentStatus.IN_TRANSIT_TO_DESTINATION, ShipmentStatus.DELIVERED] },
      postedAt: { not: null },
      pickupFee: { not: null },
      ...(hasDateFilter && { postedAt: dateFilter }),
    },
  });
  // pickupFee está em reais (Float), converter para centavos
  const partnerCommissions = Math.round((partnerCommissionsResult._sum.pickupFee || 0) * 100);

  // 5. Reembolsos: soma de REFUNDs confirmados
  const refundsResult = await prisma.walletTransaction.aggregate({
    _sum: { amountCents: true },
    where: {
      type: WalletTxType.REFUND,
      status: WalletTxStatus.CONFIRMED,
      ...(hasDateFilter && { createdAt: dateFilter }),
    },
  });
  const refunds = refundsResult._sum.amountCents || 0;

  // 6. Chargebacks: por enquanto zero (não temos tipo específico)
  // TODO: Implementar quando tivermos campo específico para chargebacks
  const chargebacks = 0;

  // 7. Saldo total nas carteiras dos clientes (não filtrado por data)
  const walletsResult = await prisma.wallet.aggregate({
    _sum: { availableCents: true },
  });
  const customersWalletBalance = walletsResult._sum.availableCents || 0;

  // 8. Saldo operacional da plataforma
  // Fórmula: Receita - Repasses - Comissões Parceiros - Reembolsos - Chargebacks
  // Nota: platformFees é parte da receita retida pela plataforma
  const platformOperationalBalance =
    grossRevenue - carrierPayouts - partnerCommissions - refunds - chargebacks;

  const summary: FinanceSummary = {
    period: { dateStart, dateEnd },
    grossRevenue,
    platformFees,
    carrierPayouts,
    partnerCommissions,
    refunds,
    chargebacks,
    customersWalletBalance,
    platformOperationalBalance,
  };

  return { data: summary };
});
