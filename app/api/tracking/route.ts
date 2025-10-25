import { NextRequest, NextResponse } from 'next/server';
import { ensureTracking } from '@/lib/api/tracking';

export type { TrackingEvent, TrackingPayload } from '@/lib/api/tracking';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shipmentId = searchParams.get('shipmentId');

  if (!shipmentId) {
    return NextResponse.json(
      { error: 'shipmentId is required' },
      { status: 400 }
    );
  }

  const tracking = ensureTracking(shipmentId);
  return NextResponse.json(tracking);
}
