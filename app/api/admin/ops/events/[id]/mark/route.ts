import { NextRequest, NextResponse } from 'next/server';
import { updateEvents } from '@/lib/admin/ops/mockSeed';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  updateEvents((events) =>
    events.map((e) => (e.id === id ? { ...e, processed: true, lastError: null } : e))
  );

  return NextResponse.json({ ok: true });
}
