import { NextRequest, NextResponse } from 'next/server';
import type { LedgerEntry, Paged } from '@/lib/admin/finance/types';

// Return only unreconciled entries
const mockUnreconciled: LedgerEntry[] = [
  {
    id: 'ldg_003',
    createdAt: '2025-01-20T14:22:00Z',
    customerId: 'cli_002',
    customerName: 'Loja Virtual XPTO',
    method: 'boleto',
    carrier: null,
    shipmentId: null,
    kind: 'deposit',
    nature: 'credit',
    amount: 10000.00,
    fee: 3.50,
    description: 'Depósito via Boleto',
    reconciled: false,
  },
  {
    id: 'ldg_005',
    createdAt: '2025-01-21T10:30:00Z',
    customerId: 'cli_004',
    customerName: 'Marketplace 123',
    method: 'card',
    carrier: null,
    shipmentId: null,
    kind: 'chargeback',
    nature: 'debit',
    amount: 350.00,
    fee: null,
    description: 'Chargeback - contestação cliente',
    reconciled: false,
  },
  {
    id: 'ldg_009',
    createdAt: '2025-01-22T16:30:00Z',
    customerId: 'cli_006',
    customerName: 'Fashion Store',
    method: 'transfer',
    carrier: null,
    shipmentId: null,
    kind: 'deposit',
    nature: 'credit',
    amount: 7500.00,
    fee: 0,
    description: 'Depósito via Transferência',
    reconciled: false,
  },
  {
    id: 'ldg_013',
    createdAt: '2025-01-24T10:00:00Z',
    customerId: 'cli_009',
    customerName: 'Eletrônicos Plus',
    method: 'card',
    carrier: null,
    shipmentId: null,
    kind: 'deposit',
    nature: 'credit',
    amount: 15000.00,
    fee: 450.00,
    description: 'Depósito via Cartão',
    reconciled: false,
  },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const q = searchParams.get('q') || '';

  let filtered = [...mockUnreconciled];

  if (q) {
    const lowerQ = q.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.customerName.toLowerCase().includes(lowerQ) ||
        e.description?.toLowerCase().includes(lowerQ)
    );
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const response: Paged<LedgerEntry> = {
    items,
    page,
    pageSize,
    total,
  };

  return NextResponse.json(response);
}
