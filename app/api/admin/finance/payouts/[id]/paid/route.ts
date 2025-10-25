import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { reference, proofUrl } = body;
  console.log('[Mock] Marking payout as paid:', id, { reference, proofUrl });
  return NextResponse.json({ ok: true });
}
