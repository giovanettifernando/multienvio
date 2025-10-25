import { NextRequest, NextResponse } from 'next/server';
import { getSeed } from '@/lib/admin/ops/mockSeed';
import type { Paged, OpsEvent } from '@/lib/admin/ops/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const processedStr = searchParams.get('processed');

  const seed = getSeed();
  let filtered = [...seed.events];

  if (processedStr !== null) {
    const processed = processedStr === 'true';
    filtered = filtered.filter((e) => e.processed === processed);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const response: Paged<OpsEvent> = {
    items,
    page,
    pageSize,
    total,
  };

  return NextResponse.json(response);
}
