/**
 * POST /api/admin/payment-transactions/sync
 *
 * Sincroniza um pagamento específico com o Mercado Pago
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { updatePaymentFromMercadoPago } from '@/lib/mercadopago/payments';


export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await requireAdminUser(req, AdminPermission.FINANCEIRO);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Obter externalId do body
    const body = await req.json();
    const { externalId } = body;

    if (!externalId) {
      return NextResponse.json(
        { error: 'externalId é obrigatório' },
        { status: 400 }
      );
    }

    // Sincronizar com Mercado Pago
    const transaction = await updatePaymentFromMercadoPago(externalId);

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        externalId: transaction.externalId,
        amountCents: transaction.amountCents,
      },
    });
  } catch (error) {
    console.error('[ADMIN_SYNC_PAYMENT]', error);
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar pagamento';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
