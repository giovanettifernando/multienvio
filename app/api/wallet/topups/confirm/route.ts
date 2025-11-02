/**
 * POST /api/wallet/topups/confirm
 *
 * Confirma um pagamento de recarga (mock de webhook)
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { confirmTransaction } from '@/lib/wallet/wallet.service';
import { ConfirmPaymentSchema } from '@/lib/validation/wallet';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Parsear e validar payload
    const payload = await request.json();
    const data = ConfirmPaymentSchema.parse(payload);

    // Confirmar transação
    await confirmTransaction(data.referenceId);

    return NextResponse.json({
      success: true,
      message: 'Pagamento confirmado com sucesso!',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 422 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: 400 }
      );
    }

    console.error('[WALLET_CONFIRM] Error confirming payment:', error);
    return NextResponse.json(
      { message: 'Erro ao confirmar pagamento' },
      { status: 500 }
    );
  }
}
