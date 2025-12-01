/**
 * GET /api/admin/payment-transactions/pending
 *
 * Lista todos os pagamentos pendentes de aprovação
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { prisma } from '@/lib/db';


export async function GET(req: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await requireAdminUser(req, AdminPermission.FINANCEIRO);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Buscar pagamentos pendentes
    const payments = await prisma.paymentTransaction.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limite de 100 registros
    });

    return NextResponse.json({
      payments,
      total: payments.length,
    });
  } catch (error) {
    console.error('[ADMIN_PENDING_PAYMENTS]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pagamentos pendentes' },
      { status: 500 }
    );
  }
}
