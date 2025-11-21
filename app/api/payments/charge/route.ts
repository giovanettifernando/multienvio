/**
 * ❌ ENDPOINT DESATIVADO - Use /api/wallet/debit
 *
 * Este endpoint foi desativado para evitar divergência de estado entre
 * o store in-memory (BillingStore) e o banco de dados real (Prisma).
 *
 * Use o endpoint real do Prisma:
 * - POST /api/wallet/debit - Debitar da carteira (com transação atômica)
 *
 * O endpoint real já suporta:
 * - Validação de saldo antes de criar recursos
 * - Transações atômicas (débito + confirmação de pagamento)
 * - Idempotência via referenceId
 * - Rollback automático em caso de falha
 *
 * Ver implementação em: /app/api/wallet/debit/route.ts
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "ENDPOINT_DEPRECATED",
      message: "Este endpoint foi desativado. Use /api/wallet/debit para débitos de carteira.",
      documentation: {
        debit: "POST /api/wallet/debit",
        wallet: "GET /api/wallet",
        transactions: "GET /api/wallet/transactions",
      },
      migration_guide: "O novo endpoint suporta transações atômicas e idempotência via referenceId.",
    },
    {
      status: 410, // 410 Gone - recurso permanentemente indisponível
      headers: {
        'X-Endpoint-Status': 'DEPRECATED',
        'X-Warning': 'Este endpoint foi desativado para evitar divergência de estado',
        'X-Redirect-To': '/api/wallet/debit',
      },
    }
  );
}
