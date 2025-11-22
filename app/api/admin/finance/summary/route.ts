import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import type { FinanceSummary } from '@/lib/admin/finance/types';

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  // Check permission
  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) return permissionError;

  const searchParams = request.nextUrl.searchParams;
  const dateStart = searchParams.get('dateStart') || undefined;
  const dateEnd = searchParams.get('dateEnd') || undefined;

  // Mock data
  const summary: FinanceSummary = {
    period: { dateStart, dateEnd },
    grossRevenue: 850000.00,
    platformFees: 42500.00,
    carrierPayouts: 650000.00,
    partnerCommissions: 25000.00,
    refunds: 12000.00,
    chargebacks: 3500.00,
    customersWalletBalance: 180000.00,
    platformOperationalBalance: 117000.00, // grossRevenue - carrierPayouts - partnerCommissions - refunds - chargebacks
  };

  return NextResponse.json(summary);
}
