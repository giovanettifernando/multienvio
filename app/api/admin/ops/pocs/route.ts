import { NextResponse } from 'next/server';
import { getSeed } from '@/lib/admin/ops/mockSeed';

export async function GET() {
  const seed = getSeed();
  return NextResponse.json(seed.pocs);
}
