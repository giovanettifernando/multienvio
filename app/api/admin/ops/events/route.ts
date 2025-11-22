import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { getSeed } from '@/lib/admin/ops/mockSeed';
import type { Paged, OpsEvent } from '@/lib/admin/ops/types';

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

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
