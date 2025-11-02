/**
 * POST /api/wallet/topups/pix
 *
 * Cria uma recarga pendente via PIX (mock)
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createTopupPending, reaisToCents } from '@/lib/wallet/wallet.service';
import { CreateTopupSchema } from '@/lib/validation/wallet';
import { getSession } from '@/lib/auth/session';
import crypto from 'crypto';

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
    const data = CreateTopupSchema.parse(payload);

    // Converter reais para centavos
    const amountCents = reaisToCents(data.amountReais);

    // Gerar referenceId único
    const referenceId = `pix_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Criar topup pendente
    const result = await createTopupPending(session.userId, amountCents, referenceId);

    return NextResponse.json({
      transactionId: result.transactionId,
      referenceId: result.referenceId,
      amountCents: result.amountCents,
      amountReais: data.amountReais,
      qrCode: result.qrCode,
      status: result.status,
      message: 'Recarga criada com sucesso. Escaneie o QR Code para pagar.',
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

    console.error('[WALLET_TOPUP_PIX] Error creating topup:', error);
    return NextResponse.json(
      { message: 'Erro ao criar recarga' },
      { status: 500 }
    );
  }
}
