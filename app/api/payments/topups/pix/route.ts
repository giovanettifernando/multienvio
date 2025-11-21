/**
 * ❌ ENDPOINT DESATIVADO - Use /api/wallet/topups/pix
 *
 * Este endpoint foi desativado para evitar divergência de estado entre
 * o store in-memory (LegacyWallet) e o banco de dados real (Prisma).
 *
 * Use o endpoint real do Prisma:
 * - POST /api/wallet/topups/pix - Criar topup PIX pendente
 *
 * O endpoint real já retorna:
 * - QR Code para pagamento
 * - Transação pendente no banco de dados (Prisma)
 * - referenceId único para idempotência
 *
 * Ver implementação em: /app/api/wallet/topups/pix/route.ts
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "ENDPOINT_DEPRECATED",
      message: "Este endpoint foi desativado. Use /api/wallet/topups/pix para criar topups PIX.",
      documentation: {
        create: "POST /api/wallet/topups/pix",
        confirm: "POST /api/wallet/topups/confirm",
        wallet: "GET /api/wallet",
      },
      migration_guide: "O novo endpoint usa Prisma para persistência real e retorna QR Code gerado.",
    },
    {
      status: 410, // 410 Gone - recurso permanentemente indisponível
      headers: {
        'X-Endpoint-Status': 'DEPRECATED',
        'X-Warning': 'Este endpoint foi desativado para evitar divergência de estado',
        'X-Redirect-To': '/api/wallet/topups/pix',
      },
    }
  );
}
