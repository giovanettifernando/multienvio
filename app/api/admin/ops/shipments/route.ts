import { NextRequest, NextResponse } from 'next/server';
import type { Paged, OpsShipment } from '@/lib/admin/ops/types';
import { getSeed } from '@/lib/admin/ops/mockSeed';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const pickupType = searchParams.get('pickupType') || '';
  const carrier = searchParams.get('carrier') || '';
  const pocId = searchParams.get('pocId') || '';
  const riskOnly = searchParams.get('riskOnly') === 'true';

  const seed = getSeed();
  let filtered = [...seed.shipments];

  if (q) {
    const lowerQ = q.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.customerName.toLowerCase().includes(lowerQ) ||
        s.orderRef?.toLowerCase().includes(lowerQ) ||
        s.trackingCode?.toLowerCase().includes(lowerQ) ||
        s.id.toLowerCase().includes(lowerQ)
    );
  }

  if (status && status !== 'all') {
    filtered = filtered.filter((s) => s.status === status);
  }

  if (pickupType && pickupType !== 'all') {
    filtered = filtered.filter((s) => s.pickupType === pickupType);
  }

  if (carrier && carrier !== 'all') {
    filtered = filtered.filter((s) => s.carrier === carrier);
  }

  if (pocId) {
    filtered = filtered.filter((s) => s.pocId === pocId);
  }

  if (riskOnly) {
    filtered = filtered.filter((s) => s.riskFlag);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const response: Paged<OpsShipment> = {
    items,
    page,
    pageSize,
    total,
  };

  return NextResponse.json(response);
}
