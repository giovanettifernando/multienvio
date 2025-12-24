/**
 * GET /api/admin/finance/carrier-payouts
 *
 * Calcula os repasses às transportadoras baseado em shipments/labels pagos.
 * Agrupa por transportadora e retorna:
 * - Valor bruto (o que foi cobrado do cliente)
 * - Taxa da plataforma (nossa margem)
 * - Valor líquido a repassar (bruto - taxa)
 *
 * IMPORTANTE: Esta API é para reconciliação com faturas das transportadoras.
 * Usa Labels com status 'paid' ou 'issued' como base para o cálculo.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireAdminSession } from '@/platform/auth/require-session';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/platform/db/db';
import { startOfDayBrasilia, endOfDayBrasilia } from '@/shared/utils/date';


// Tipos para a resposta
export interface CarrierPayoutShipment {
  id: string;
  platformTrackingCode: string;
  carrierTrackingCode: string | null;
  carrier: string;
  service: string | null;
  labelStatus: string;
  /** Custo real da transportadora (soma dos carrierQuotePrice dos pacotes) em centavos */
  carrierCostCents: number;
  /** Custo real da transportadora em reais */
  carrierCostReais: number;
  platformCommissionCents: number;
  /** Data de postagem (competência) */
  postedAt: string | null;
  createdAt: string;
  destinationCity: string;
  destinationState: string;
}

export interface CarrierPayoutSummary {
  carrier: string;
  shipmentCount: number;
  /** Total do custo real da transportadora (soma dos carrierQuotePrice) em centavos */
  carrierCostCents: number;
  /** Total do custo real da transportadora em reais */
  carrierCostReais: number;
  shipments: CarrierPayoutShipment[];
}

export interface CarrierPayoutsResponse {
  period: {
    dateStart: string;
    dateEnd: string;
  };
  summary: {
    totalShipments: number;
    /** Total do custo real das transportadoras em reais */
    totalCarrierCostReais: number;
  };
  carriers: CarrierPayoutSummary[];
}

export const GET = withApiHandler<CarrierPayoutsResponse>(async ({ req }) => {
  await requireAdminSession(req, AdminPermission.FINANCEIRO);

  const searchParams = req.nextUrl.searchParams;
  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');
  const carrierFilter = searchParams.get('carrier');

  // Validar período
  if (!dateStart || !dateEnd) {
    throw new ApiError({ code: 'BAD_REQUEST', message: 'Período obrigatório (dateStart e dateEnd)', status: 400 });
  }

  // Usar UTC-3 (Brasília) para filtros de data
  const startDate = startOfDayBrasilia(dateStart);
  const endDate = endOfDayBrasilia(dateEnd);

  // Buscar shipments postados no período (usando postedAt como data de competência)
  // Apenas shipments que foram efetivamente postados geram repasse à transportadora
  const shipments = await prisma.shipment.findMany({
    where: {
      postedAt: {
        gte: startDate,
        lte: endDate,
      },
      carrier: carrierFilter ? carrierFilter : { not: null },
    },
    include: {
      label: true,
      packages: {
        select: {
          carrierQuotePrice: true,
        },
      },
    },
    orderBy: {
      postedAt: 'desc',
    },
  });

  // Agrupar por transportadora
  const carrierMap = new Map<string, CarrierPayoutSummary>();

  for (const shipment of shipments) {
    if (!shipment.carrier || !shipment.label) continue;

    const carrier = shipment.carrier;
    const platformCommissionCents = shipment.platformShippingCommissionCents || 0;

    // Usar carrierQuotePrice (custo real da transportadora) em vez de priceCents
    // carrierQuotePrice está em reais (Float), converter para centavos
    const carrierCostReais = shipment.packages.reduce(
      (sum, pkg) => sum + (pkg.carrierQuotePrice || 0),
      0
    );
    const carrierCostCents = Math.round(carrierCostReais * 100);

    const shipmentData: CarrierPayoutShipment = {
      id: shipment.id,
      platformTrackingCode: shipment.platformTrackingCode,
      carrierTrackingCode: shipment.carrierTrackingCode,
      carrier: shipment.carrier,
      service: shipment.service,
      labelStatus: shipment.label.status,
      carrierCostCents,
      carrierCostReais,
      platformCommissionCents,
      postedAt: shipment.postedAt?.toISOString() || null,
      createdAt: shipment.createdAt.toISOString(),
      destinationCity: shipment.destinationCity,
      destinationState: shipment.destinationState,
    };

    if (!carrierMap.has(carrier)) {
      carrierMap.set(carrier, {
        carrier,
        shipmentCount: 0,
        carrierCostCents: 0,
        carrierCostReais: 0,
        shipments: [],
      });
    }

    const carrierSummary = carrierMap.get(carrier)!;
    carrierSummary.shipmentCount++;
    carrierSummary.carrierCostCents += carrierCostCents;
    carrierSummary.shipments.push(shipmentData);
  }

  // Calcular valores em reais e ordenar shipments por data
  const carriers: CarrierPayoutSummary[] = [];
  let totalShipments = 0;
  let totalCarrierCostCents = 0;

  for (const [, summary] of carrierMap) {
    summary.carrierCostReais = summary.carrierCostCents / 100;

    // Ordenar shipments por data de postagem (mais recente primeiro)
    summary.shipments.sort((a, b) => {
      const dateA = a.postedAt || a.createdAt;
      const dateB = b.postedAt || b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    carriers.push(summary);

    totalShipments += summary.shipmentCount;
    totalCarrierCostCents += summary.carrierCostCents;
  }

  // Ordenar transportadoras por custo total (maior primeiro)
  carriers.sort((a, b) => b.carrierCostCents - a.carrierCostCents);

  const response: CarrierPayoutsResponse = {
    period: {
      dateStart: startDate.toISOString(),
      dateEnd: endDate.toISOString(),
    },
    summary: {
      totalShipments,
      totalCarrierCostReais: totalCarrierCostCents / 100,
    },
    carriers,
  };

  return { data: response };
});
