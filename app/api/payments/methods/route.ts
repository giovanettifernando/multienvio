/**
 * ❌ ENDPOINT DESATIVADO - Use /api/account/cards
 *
 * Este endpoint foi desativado para evitar divergência de estado entre
 * o store in-memory (BillingStore) e o banco de dados real (Prisma).
 *
 * Use os endpoints reais do Prisma:
 * - GET /api/account/cards - Listar cartões
 * - POST /api/account/cards - Adicionar cartão
 * - PATCH /api/account/cards/[id]/make-default - Definir como padrão
 * - DELETE /api/account/cards/[id] - Remover cartão
 *
 * O frontend já foi migrado para usar /api/account/cards
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function createGoneResponse(method: string) {
  return NextResponse.json(
    {
      error: "ENDPOINT_DEPRECATED",
      message: `Este endpoint foi desativado. Use /api/account/cards para ${method} cartões.`,
      documentation: {
        list: "GET /api/account/cards",
        create: "POST /api/account/cards",
        setDefault: "PATCH /api/account/cards/[id]/make-default",
        delete: "DELETE /api/account/cards/[id]",
      },
    },
    {
      status: 410, // 410 Gone - recurso permanentemente indisponível
      headers: {
        'X-Endpoint-Status': 'DEPRECATED',
        'X-Warning': 'Este endpoint foi desativado para evitar divergência de estado',
        'X-Redirect-To': '/api/account/cards',
      },
    }
  );
}

export async function GET() {
  return createGoneResponse("listar");
}

export async function POST() {
  return createGoneResponse("adicionar");
}

export async function PATCH() {
  return createGoneResponse("atualizar");
}

export async function DELETE() {
  return createGoneResponse("remover");
}
