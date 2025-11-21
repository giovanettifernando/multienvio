/**
 * ❌ ENDPOINT DESATIVADO - Use /api/wallet/topups/confirm
 *
 * Este endpoint foi desativado para evitar divergência de estado entre
 * o store in-memory (BillingStore) e o banco de dados real (Prisma).
 *
 * Use o endpoint real do Prisma:
 * - POST /api/wallet/topups/confirm - Confirmar topup PIX
 *
 * O webhook real deve chamar este endpoint após receber confirmação do gateway de pagamento.
 *
 * Ver implementação em: /app/api/wallet/topups/confirm/route.ts
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "ENDPOINT_DEPRECATED",
      message: "Este endpoint foi desativado. Use /api/wallet/topups/confirm para confirmar topups PIX.",
      documentation: {
        confirm: "POST /api/wallet/topups/confirm",
        create: "POST /api/wallet/topups/pix",
        wallet: "GET /api/wallet",
      },
      migration_guide: "O novo endpoint usa Prisma para persistência real e suporta idempotência.",
    },
    {
      status: 410, // 410 Gone - recurso permanentemente indisponível
      headers: {
        'X-Endpoint-Status': 'DEPRECATED',
        'X-Warning': 'Este endpoint foi desativado para evitar divergência de estado',
        'X-Redirect-To': '/api/wallet/topups/confirm',
      },
    }
  );
}
