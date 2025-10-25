import { NextRequest, NextResponse } from 'next/server';
import type { ChargebackItem, Paged } from '@/lib/admin/finance/types';

const mockChargebacks: ChargebackItem[] = [
  {
    id: 'chb_001',
    createdAt: '2025-01-18T10:00:00Z',
    customerId: 'cli_004',
    customerName: 'Marketplace 123',
    method: 'card',
    amount: 350.00,
    status: 'review',
    reason: 'Cliente não reconhece compra',
  },
  {
    id: 'chb_002',
    createdAt: '2025-01-19T14:30:00Z',
    customerId: 'cli_008',
    customerName: 'Varejo Online',
    method: 'card',
    amount: 120.50,
    status: 'approved',
    reason: 'Produto não entregue',
  },
  {
    id: 'chb_003',
    createdAt: '2025-01-20T09:15:00Z',
    customerId: 'cli_002',
    customerName: 'Loja Virtual XPTO',
    method: 'card',
    amount: 89.90,
    status: 'denied',
    reason: 'Fraude comprovada',
  },
  {
    id: 'chb_004',
    createdAt: '2025-01-21T11:00:00Z',
    customerId: 'cli_006',
    customerName: 'Fashion Store',
    method: 'card',
    amount: 450.00,
    status: 'review',
    reason: 'Produto divergente',
  },
  {
    id: 'chb_005',
    createdAt: '2025-01-22T16:45:00Z',
    customerId: 'cli_009',
    customerName: 'Eletrônicos Plus',
    method: 'card',
    amount: 1200.00,
    status: 'approved',
    reason: 'Cobrança duplicada',
  },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const method = searchParams.get('method') || '';
  const customerId = searchParams.get('customerId') || '';

  let filtered = [...mockChargebacks];

  if (q) {
    const lowerQ = q.toLowerCase();
    filtered = filtered.filter(
      (cb) =>
        cb.customerName.toLowerCase().includes(lowerQ) ||
        cb.reason?.toLowerCase().includes(lowerQ)
    );
  }

  if (status) {
    filtered = filtered.filter((cb) => cb.status === status);
  }

  if (method) {
    filtered = filtered.filter((cb) => cb.method === method);
  }

  if (customerId) {
    filtered = filtered.filter((cb) => cb.customerId === customerId);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const response: Paged<ChargebackItem> = {
    items,
    page,
    pageSize,
    total,
  };

  return NextResponse.json(response);
}
