import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import type { LedgerEntry, Paged } from '@/lib/admin/finance/types';

// Mock ledger data
const mockLedger: LedgerEntry[] = [
  {
    id: 'ldg_001',
    createdAt: '2025-01-20T10:30:00Z',
    customerId: 'cli_001',
    customerName: 'Tech Solutions Ltda',
    method: 'pix',
    carrier: null,
    shipmentId: null,
    kind: 'deposit',
    nature: 'credit',
    amount: 5000.00,
    fee: 0,
    description: 'Depósito via PIX',
    reconciled: true,
  },
  {
    id: 'ldg_002',
    createdAt: '2025-01-20T11:15:00Z',
    customerId: 'cli_001',
    customerName: 'Tech Solutions Ltda',
    method: 'card',
    carrier: 'Correios',
    shipmentId: 'shp_123',
    kind: 'purchase',
    nature: 'debit',
    amount: 45.50,
    fee: 2.28,
    description: 'Compra etiqueta PAC',
    reconciled: true,
  },
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
    id: 'ldg_004',
    createdAt: '2025-01-21T09:00:00Z',
    customerId: 'cli_003',
    customerName: 'E-commerce ABC',
    method: null,
    carrier: null,
    shipmentId: null,
    kind: 'refund',
    nature: 'credit',
    amount: 120.00,
    fee: null,
    description: 'Estorno - envio cancelado',
    reconciled: true,
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
    id: 'ldg_006',
    createdAt: '2025-01-21T15:45:00Z',
    customerId: 'cli_001',
    customerName: 'Tech Solutions Ltda',
    method: null,
    carrier: 'Jadlog',
    shipmentId: 'shp_456',
    kind: 'purchase',
    nature: 'debit',
    amount: 38.90,
    fee: 1.95,
    description: 'Compra etiqueta .Package',
    reconciled: true,
  },
  {
    id: 'ldg_007',
    createdAt: '2025-01-22T08:20:00Z',
    customerId: 'cli_005',
    customerName: 'Distribuidora Sul',
    method: 'pix',
    carrier: null,
    shipmentId: null,
    kind: 'deposit',
    nature: 'credit',
    amount: 25000.00,
    fee: 0,
    description: 'Depósito via PIX',
    reconciled: true,
  },
  {
    id: 'ldg_008',
    createdAt: '2025-01-22T11:00:00Z',
    customerId: 'cli_002',
    customerName: 'Loja Virtual XPTO',
    method: null,
    carrier: null,
    shipmentId: null,
    kind: 'fee',
    nature: 'debit',
    amount: 15.00,
    fee: null,
    description: 'Taxa mensal plataforma',
    reconciled: true,
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
    id: 'ldg_010',
    createdAt: '2025-01-23T09:15:00Z',
    customerId: 'cli_007',
    customerName: 'Importadora XYZ',
    method: null,
    carrier: null,
    shipmentId: null,
    kind: 'adjustment',
    nature: 'credit',
    amount: 500.00,
    fee: null,
    description: 'Ajuste manual - bonificação',
    reconciled: true,
  },
  {
    id: 'ldg_011',
    createdAt: '2025-01-23T13:45:00Z',
    customerId: 'cli_008',
    customerName: 'Varejo Online',
    method: null,
    carrier: 'Loggi',
    shipmentId: 'shp_789',
    kind: 'purchase',
    nature: 'debit',
    amount: 28.50,
    fee: 1.43,
    description: 'Compra etiqueta Express',
    reconciled: true,
  },
  {
    id: 'ldg_012',
    createdAt: '2025-01-23T17:00:00Z',
    customerId: 'cli_001',
    customerName: 'Tech Solutions Ltda',
    method: null,
    carrier: null,
    shipmentId: null,
    kind: 'commission',
    nature: 'debit',
    amount: 150.00,
    fee: null,
    description: 'Comissão canal parceiro',
    reconciled: true,
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
  {
    id: 'ldg_014',
    createdAt: '2025-01-24T14:30:00Z',
    customerId: 'cli_005',
    customerName: 'Distribuidora Sul',
    method: null,
    carrier: 'Correios',
    shipmentId: 'shp_890',
    kind: 'purchase',
    nature: 'debit',
    amount: 52.00,
    fee: 2.60,
    description: 'Compra etiqueta SEDEX',
    reconciled: true,
  },
  {
    id: 'ldg_015',
    createdAt: '2025-01-24T16:45:00Z',
    customerId: 'cli_010',
    customerName: 'Atacado Premium',
    method: 'pix',
    carrier: null,
    shipmentId: null,
    kind: 'deposit',
    nature: 'credit',
    amount: 30000.00,
    fee: 0,
    description: 'Depósito via PIX',
    reconciled: true,
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
  const customerId = searchParams.get('customerId') || '';
  const carrier = searchParams.get('carrier') || '';
  const method = searchParams.get('method') || '';
  const kind = searchParams.get('kind') || '';
  const reconciledStr = searchParams.get('reconciled');

  let filtered = [...mockLedger];

  // Apply filters
  if (q) {
    const lowerQ = q.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.customerName.toLowerCase().includes(lowerQ) ||
        e.description?.toLowerCase().includes(lowerQ) ||
        e.customerId.toLowerCase().includes(lowerQ)
    );
  }

  if (customerId) {
    filtered = filtered.filter((e) => e.customerId === customerId);
  }

  if (carrier) {
    filtered = filtered.filter((e) => e.carrier === carrier);
  }

  if (method) {
    filtered = filtered.filter((e) => e.method === method);
  }

  if (kind) {
    filtered = filtered.filter((e) => e.kind === kind);
  }

  if (reconciledStr !== null) {
    const reconciled = reconciledStr === 'true';
    filtered = filtered.filter((e) => e.reconciled === reconciled);
  }

  // Pagination
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
