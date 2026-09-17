import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';
import { AdminPermission, WalletTxType, WalletTxStatus } from '@prisma/client';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';
import type { FinanceSummary } from '@/modules/admin/application/finance/types';
import { startOfDayBrasilia, endOfDayBrasilia } from '@/shared/utils/date';

export const GET = withApiHandler<FinanceSummary>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.FINANCEIRO);

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

  // 2. Taxas da plataforma: comissões sobre frete e seguro (usando postedAt como competência)
  const platformFeesResult = await prisma.shipment.aggregate({
    _sum: {
      platformShippingCommissionCents: true,
      platformInsuranceCommissionCents: true,
    },
    where: {
      status: { in: [ShipmentStatus.RECEIVED_AT_ORIGIN_HUB, ShipmentStatus.IN_TRANSIT_TO_DESTINATION, ShipmentStatus.DELIVERED] },
      postedAt: { not: null },
      ...(hasDateFilter && { postedAt: dateFilter }),
    },
  });
  const platformFees =
    (platformFeesResult._sum.platformShippingCommissionCents || 0) +
    (platformFeesResult._sum.platformInsuranceCommissionCents || 0);

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
  // Fórmula: Receita - Repasses - Reembolsos - Chargebacks
  // Nota: platformFees é parte da receita retida pela plataforma
  const platformOperationalBalance =
    grossRevenue - carrierPayouts - refunds - chargebacks;

  const summary: FinanceSummary = {
    period: { dateStart, dateEnd },
    grossRevenue,
    platformFees,
    carrierPayouts,
    refunds,
    chargebacks,
    customersWalletBalance,
    platformOperationalBalance,
  };

  return { data: summary };
});
