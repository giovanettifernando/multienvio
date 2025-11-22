/**
 * GET /api/payments/mercadopago/public-key
 *
 * Retorna a chave pública do Mercado Pago para uso no frontend
 * Esta chave é segura para ser exposta publicamente
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getMercadoPagoPublicKey } from '@/lib/mercadopago/config';

export async function GET() {
  try {
    const publicKey = await getMercadoPagoPublicKey();

    if (!publicKey) {
      return NextResponse.json(
        {
          error: 'Mercado Pago não configurado',
          message: 'Configure as credenciais do Mercado Pago no painel admin ou nas variáveis de ambiente',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      publicKey,
    });
  } catch (error) {
    console.error('[MP_PUBLIC_KEY]', error);
    return NextResponse.json(
      {
        error: 'Erro ao buscar chave pública',
        message: 'Erro interno ao buscar credenciais do Mercado Pago',
      },
      { status: 500 }
    );
  }
}
