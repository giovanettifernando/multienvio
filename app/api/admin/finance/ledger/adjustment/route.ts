import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Mock: just return success with generated ID
  // In real implementation, would create entry in DB
  console.log('[Mock] Creating adjustment:', body);

  const id = `ldg_adj_${Date.now()}`;

  return NextResponse.json({ ok: true, id });
}
