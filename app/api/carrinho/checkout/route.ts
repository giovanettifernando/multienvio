import { NextResponse } from 'next/server';


/**
 * @deprecated Este endpoint foi descontinuado.
 * Use /api/cart/checkout em vez deste.
 *
 * O antigo endpoint usava memória global (globalThis) para armazenar
 * o carrinho, o que causava inconsistências e perda de dados.
 *
 * O novo endpoint /api/cart/checkout usa Prisma/PostgreSQL para
 * persistência correta e suporta idempotência.
 */
export async function POST() {
  console.warn('[DEPRECATED] /api/carrinho/checkout foi chamado. Use /api/cart/checkout.');

  return NextResponse.json(
    {
      ok: false,
      code: 'ENDPOINT_DEPRECATED',
      message: 'Este endpoint foi descontinuado. Use /api/cart/checkout em vez deste.',
      migration: {
        oldEndpoint: '/api/carrinho/checkout',
        newEndpoint: '/api/cart/checkout',
        reason: 'O antigo endpoint usava memória volátil e não persistia dados corretamente.',
      },
    },
    { status: 410 } // 410 Gone - recurso não está mais disponível
  );
}
