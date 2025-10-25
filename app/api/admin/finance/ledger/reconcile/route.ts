import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { ids } = body;

  // Mock: just return success
  // In real implementation, would update DB
  console.log('[Mock] Reconciling ledger entries:', ids);

  return NextResponse.json({ ok: true });
}
