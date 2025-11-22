/**
 * ⚠️ MOCK ROUTE - REMOVE IN PRODUCTION
 * This route returns fake data and should be removed or protected before deployment
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

  // ⚠️ WARNING: Mock implementation - returns fake data
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { message: 'Mock route not available in production' },
      { status: 501 }
    );
  }

  const payload = await req.json().catch(() => ({}));
  const paid = payload?.payment?.action === "PAGAR_AGORA";
  return NextResponse.json({
    shipmentId: "shp_123",
    status: paid ? "PAGO" : "NO_CARRINHO",
    etiqueta: paid
      ? { id: "etq_123", url: "/meus-envios/etiqueta/etq_123" }
      : undefined,
  });
}
