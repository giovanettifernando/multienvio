import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { ids } = body;
  console.log('[Mock] Marking as reconciled:', ids);
  return NextResponse.json({ ok: true });
}
