/**
 * ⚠️ MOCK ROUTE - REMOVE IN PRODUCTION
 * This route returns fake data and should be removed or protected before deployment
 *
 * 🚨 SECURITY WARNINGS:
 * - This endpoint trusts client-controlled payment.action without server-side verification
 * - It returns "PAGO" status based solely on client input
 * - NEVER use this in production - it enables payment spoofing
 * - This is ONLY for frontend development/testing
 */

import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";

export async function POST(req: Request) {
  // 🚨 SECURITY: Require authentication
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { message: 'Autenticação necessária' },
      { status: 401 }
    );
  }

  // 🚨 SECURITY: Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { message: 'Mock route not available in production' },
      { status: 501 }
    );
  }

  // ⚠️ WARNING: This accepts client-controlled payment status WITHOUT validation
  // In production, NEVER trust client input for payment confirmation
  const payload = await req.json().catch(() => ({}));
  const paid = payload?.payment?.action === "PAGAR_AGORA";

  console.warn('⚠️ MOCK ENDPOINT: Returning fake payment status based on client input (NEVER use in production)');

  return NextResponse.json({
    shipmentId: "shp_123",
    status: paid ? "PAGO" : "NO_CARRINHO",
    etiqueta: paid
      ? { id: "etq_123", url: "/meus-envios/etiqueta/etq_123" }
      : undefined,
  });
}
