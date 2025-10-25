import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status } = body;
  console.log('[Mock] Updating chargeback:', id, 'to', status);
  return NextResponse.json({ ok: true });
}
