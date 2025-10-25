import { NextRequest, NextResponse } from 'next/server';
import type { CarrierPayout, Paged } from '@/lib/admin/finance/types';

const mockPayouts: CarrierPayout[] = [
  {
    id: 'pyt_001',
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-01-15T23:59:59Z',
    carrier: 'Correios',
    amount: 125000.00,
    status: 'paid',
    reference: 'REM-2025-001',
    proofUrl: 'https://exemplo.com/comprovante/pyt_001.pdf',
  },
  {
    id: 'pyt_002',
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-01-15T23:59:59Z',
    carrier: 'Jadlog',
    amount: 85000.00,
    status: 'pending',
    reference: null,
    proofUrl: null,
  },
  {
    id: 'pyt_003',
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-01-15T23:59:59Z',
    carrier: 'Loggi',
    amount: 45000.00,
    status: 'pending',
    reference: null,
    proofUrl: null,
  },
  {
    id: 'pyt_004',
    periodStart: '2025-01-16T00:00:00Z',
    periodEnd: '2025-01-31T23:59:59Z',
    carrier: 'Correios',
    amount: 150000.00,
    status: 'pending',
    reference: null,
    proofUrl: null,
  },
  {
    id: 'pyt_005',
    periodStart: '2025-01-16T00:00:00Z',
    periodEnd: '2025-01-31T23:59:59Z',
    carrier: 'Jadlog',
    amount: 95000.00,
    status: 'pending',
    reference: null,
    proofUrl: null,
  },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const carrier = searchParams.get('carrier') || '';
  const status = searchParams.get('status') || '';

  let filtered = [...mockPayouts];

  if (carrier) {
    filtered = filtered.filter((p) => p.carrier === carrier);
  }

  if (status) {
    filtered = filtered.filter((p) => p.status === status);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const response: Paged<CarrierPayout> = {
    items,
    page,
    pageSize,
    total,
  };

  return NextResponse.json(response);
}
