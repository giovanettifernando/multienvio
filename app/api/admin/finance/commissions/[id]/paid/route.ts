import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Mock] Marking commission as paid:', id);
  return NextResponse.json({ ok: true });
}
