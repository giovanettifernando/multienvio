import { NextRequest, NextResponse } from 'next/server';
import { updatePoCs } from '@/lib/admin/ops/mockSeed';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  updatePoCs((pocs) =>
    pocs.map((p) => (p.id === id ? { ...p, ...body } : p))
  );

  return NextResponse.json({ ok: true });
}
