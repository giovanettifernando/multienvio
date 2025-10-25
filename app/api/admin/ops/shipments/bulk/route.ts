import { NextRequest, NextResponse } from 'next/server';
import { updateShipments } from '@/lib/admin/ops/mockSeed';
import type { ShipmentStatus } from '@/lib/admin/ops/types';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { ids, status } = body as { ids: string[]; status: ShipmentStatus };

  updateShipments((shipments) =>
    shipments.map((s) =>
      ids.includes(s.id)
        ? { ...s, status, updatedAt: new Date().toISOString() }
        : s
    )
  );

  return NextResponse.json({ ok: true });
}
