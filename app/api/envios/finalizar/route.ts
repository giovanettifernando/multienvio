import { NextResponse } from "next/server";

export async function POST(req: Request) {
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
