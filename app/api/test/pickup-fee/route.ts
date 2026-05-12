import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/platform/db/db';
import { applyPickupFeeCommission } from '@/modules/quotes/application/commission';

// Endpoint de teste — disponível apenas fora de produção
export async function GET(req: NextRequest) {
  if (process.env.APP_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const collectorId = req.nextUrl.searchParams.get('collector') ?? 'collector_teste_01';
  const freightCost = parseFloat(req.nextUrl.searchParams.get('frete') ?? '0');
  const distanceKm = parseFloat(req.nextUrl.searchParams.get('km') ?? '0.1');

  const collector = await prisma.collector.findUnique({
    where: { id: collectorId },
    select: {
      id: true,
      pfNome: true,
      pickupFeeType: true,
      pickupFixedFee: true,
      pickupFeePerKm: true,
      pickupFeeMinimum: true,
    },
  });

  if (!collector) {
    return NextResponse.json({ error: `Coletor "${collectorId}" não encontrado` }, { status: 404 });
  }

  let baseFee = 0;
  if (collector.pickupFeeType === 'FIXED') {
    baseFee = collector.pickupFixedFee ?? 0;
  } else {
    baseFee = distanceKm * (collector.pickupFeePerKm ?? 0);
  }
  baseFee = Math.round(baseFee * 100) / 100;

  const minimum = collector.pickupFeeMinimum ?? 0;
  const minimumApplied = minimum > 0 && baseFee < minimum;
  if (minimumApplied) baseFee = minimum;

  const { finalFee, commissionAmount, commissionPercent } = await applyPickupFeeCommission(baseFee);

  return NextResponse.json({
    collector: { id: collector.id, nome: collector.pfNome },
    config: {
      tipo: collector.pickupFeeType,
      valorFixo: collector.pickupFixedFee,
      valorPorKm: collector.pickupFeePerKm,
      taxaMinima: collector.pickupFeeMinimum,
    },
    calculo: {
      distanciaKm: distanceKm,
      taxaBase: baseFee,
      minimoAplicado: minimumApplied,
      comissaoPlataforma: `${commissionPercent}% = R$ ${commissionAmount.toFixed(2)}`,
      taxaFinal: finalFee,
      totalComFrete: freightCost + finalFee,
    },
  });
}
