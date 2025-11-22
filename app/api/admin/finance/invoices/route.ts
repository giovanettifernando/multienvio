import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import type { Invoice, Paged } from '@/lib/admin/finance/types';

const mockInvoices: Invoice[] = [
  {
    id: 'inv_001',
    issueDate: '2025-01-01T00:00:00Z',
    dueDate: '2025-01-15T00:00:00Z',
    status: 'paid',
    customerId: 'cli_001',
    customerName: 'Tech Solutions Ltda',
    total: 5000.00,
    link: 'https://exemplo.com/nota/inv_001.pdf',
  },
  {
    id: 'inv_002',
    issueDate: '2025-01-05T00:00:00Z',
    dueDate: '2025-01-20T00:00:00Z',
    status: 'open',
    customerId: 'cli_002',
    customerName: 'Loja Virtual XPTO',
    total: 10000.00,
    link: 'https://exemplo.com/nota/inv_002.pdf',
  },
  {
    id: 'inv_003',
    issueDate: '2025-01-10T00:00:00Z',
    dueDate: '2025-01-25T00:00:00Z',
    status: 'open',
    customerId: 'cli_003',
    customerName: 'E-commerce ABC',
    total: 7500.00,
    link: 'https://exemplo.com/nota/inv_003.pdf',
  },
  {
    id: 'inv_004',
    issueDate: '2025-01-12T00:00:00Z',
    dueDate: '2025-01-27T00:00:00Z',
    status: 'canceled',
    customerId: 'cli_004',
    customerName: 'Marketplace 123',
    total: 3200.00,
    link: null,
  },
  {
    id: 'inv_005',
    issueDate: '2025-01-15T00:00:00Z',
    dueDate: '2025-01-30T00:00:00Z',
    status: 'paid',
    customerId: 'cli_005',
    customerName: 'Distribuidora Sul',
    total: 25000.00,
    link: 'https://exemplo.com/nota/inv_005.pdf',
  },
  {
    id: 'inv_006',
    issueDate: '2025-01-18T00:00:00Z',
    dueDate: '2025-02-02T00:00:00Z',
    status: 'open',
    customerId: 'cli_006',
    customerName: 'Fashion Store',
    total: 8900.00,
    link: 'https://exemplo.com/nota/inv_006.pdf',
  },
  {
    id: 'inv_007',
    issueDate: '2025-01-20T00:00:00Z',
    dueDate: '2025-02-05T00:00:00Z',
    status: 'open',
    customerId: 'cli_007',
    customerName: 'Importadora XYZ',
    total: 15000.00,
    link: 'https://exemplo.com/nota/inv_007.pdf',
  },
];

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const customerId = searchParams.get('customerId') || '';

  let filtered = [...mockInvoices];

  if (q) {
    const lowerQ = q.toLowerCase();
    filtered = filtered.filter(
      (inv) =>
        inv.id.toLowerCase().includes(lowerQ) ||
        inv.customerName?.toLowerCase().includes(lowerQ)
    );
  }

  if (status) {
    filtered = filtered.filter((inv) => inv.status === status);
  }

  if (customerId) {
    filtered = filtered.filter((inv) => inv.customerId === customerId);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const response: Paged<Invoice> = {
    items,
    page,
    pageSize,
    total,
  };

  return NextResponse.json(response);
}
