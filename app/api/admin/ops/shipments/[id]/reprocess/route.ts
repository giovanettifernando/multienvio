import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Mock] Reprocessing shipment:', id);
  return NextResponse.json({ ok: true });
}
