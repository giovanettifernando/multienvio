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

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';


// Tipos para a resposta
export interface CarrierPayoutShipment {
  id: string;
  platformTrackingCode: string;
  carrierTrackingCode: string | null;
  carrier: string;
  service: string | null;
  labelStatus: string;
  labelPriceCents: number;
  freightCostReais: number;
  platformCommissionCents: number;
  netPayoutReais: number;
  postedAt: string | null;
  createdAt: string;
  destinationCity: string;
  destinationState: string;
}

export interface CarrierPayoutSummary {
  carrier: string;
  shipmentCount: number;
  grossAmountCents: number;
  grossAmountReais: number;
  platformCommissionCents: number;
  platformCommissionReais: number;
  netPayoutCents: number;
  netPayoutReais: number;
  shipments: CarrierPayoutShipment[];
}

export interface CarrierPayoutsResponse {
  period: {
    dateStart: string;
    dateEnd: string;
  };
  summary: {
    totalShipments: number;
    totalGrossReais: number;
    totalPlatformCommissionReais: number;
    totalNetPayoutReais: number;
  };
  carriers: CarrierPayoutSummary[];
}

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
    const carrierFilter = searchParams.get('carrier');

    // Validar período
    if (!dateStart || !dateEnd) {
      return NextResponse.json(
        { message: 'Período obrigatório (dateStart e dateEnd)' },
        { status: 400 }
      );
    }

    const startDate = new Date(dateStart);
    const endDate = new Date(dateEnd);

    // Buscar shipments com labels pagas/emitidas no período
    // Usamos a data de criação da Label como referência para o período
    const shipments = await prisma.shipment.findMany({
      where: {
        label: {
          status: { in: ['paid', 'issued'] },
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        carrier: carrierFilter ? carrierFilter : { not: null },
      },
      include: {
        label: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Agrupar por transportadora
    const carrierMap = new Map<string, CarrierPayoutSummary>();

    for (const shipment of shipments) {
      if (!shipment.carrier || !shipment.label) continue;

      const carrier = shipment.carrier;
      const labelPriceCents = shipment.label.priceCents;
      const platformCommissionCents = shipment.platformShippingCommissionCents || 0;

      // O valor líquido a repassar é o preço da etiqueta menos a comissão da plataforma
      // Nota: Se platformShippingCommissionCents não estiver preenchido, assumimos que
      // o valor da etiqueta já é o valor que devemos à transportadora
      const netPayoutCents = labelPriceCents - platformCommissionCents;

      const shipmentData: CarrierPayoutShipment = {
        id: shipment.id,
        platformTrackingCode: shipment.platformTrackingCode,
        carrierTrackingCode: shipment.carrierTrackingCode,
        carrier: shipment.carrier,
        service: shipment.service,
        labelStatus: shipment.label.status,
        labelPriceCents: labelPriceCents,
        freightCostReais: labelPriceCents / 100,
        platformCommissionCents: platformCommissionCents,
        netPayoutReais: netPayoutCents / 100,
        postedAt: shipment.postedAt?.toISOString() || null,
        createdAt: shipment.label.createdAt.toISOString(),
        destinationCity: shipment.destinationCity,
        destinationState: shipment.destinationState,
      };

      if (!carrierMap.has(carrier)) {
        carrierMap.set(carrier, {
          carrier,
          shipmentCount: 0,
          grossAmountCents: 0,
          grossAmountReais: 0,
          platformCommissionCents: 0,
          platformCommissionReais: 0,
          netPayoutCents: 0,
          netPayoutReais: 0,
          shipments: [],
        });
      }

      const carrierSummary = carrierMap.get(carrier)!;
      carrierSummary.shipmentCount++;
      carrierSummary.grossAmountCents += labelPriceCents;
      carrierSummary.platformCommissionCents += platformCommissionCents;
      carrierSummary.netPayoutCents += netPayoutCents;
      carrierSummary.shipments.push(shipmentData);
    }

    // Calcular valores em reais e ordenar shipments por data
    const carriers: CarrierPayoutSummary[] = [];
    let totalShipments = 0;
    let totalGrossCents = 0;
    let totalCommissionCents = 0;
    let totalNetCents = 0;

    for (const [, summary] of carrierMap) {
      summary.grossAmountReais = summary.grossAmountCents / 100;
      summary.platformCommissionReais = summary.platformCommissionCents / 100;
      summary.netPayoutReais = summary.netPayoutCents / 100;

      // Ordenar shipments por data de criação (mais recente primeiro)
      summary.shipments.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      carriers.push(summary);

      totalShipments += summary.shipmentCount;
      totalGrossCents += summary.grossAmountCents;
      totalCommissionCents += summary.platformCommissionCents;
      totalNetCents += summary.netPayoutCents;
    }

    // Ordenar transportadoras por valor bruto (maior primeiro)
    carriers.sort((a, b) => b.grossAmountCents - a.grossAmountCents);

    const response: CarrierPayoutsResponse = {
      period: {
        dateStart: startDate.toISOString(),
        dateEnd: endDate.toISOString(),
      },
      summary: {
        totalShipments,
        totalGrossReais: totalGrossCents / 100,
        totalPlatformCommissionReais: totalCommissionCents / 100,
        totalNetPayoutReais: totalNetCents / 100,
      },
      carriers,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[CARRIER_PAYOUTS] Error:', error);
    return NextResponse.json(
      { message: 'Erro ao calcular repasses' },
      { status: 500 }
    );
  }
}
