import { NextRequest, NextResponse } from "next/server";
import type { CheckoutPayload, Cart } from "@/types/cart";
import type { Shipment } from "@/types/shipment";

export const dynamic = "force-dynamic";

declare global {
  var __envioCart: Cart | undefined;
  var __envioShipmentsArray: Shipment[] | undefined;
}

function getCartStore(): Cart {
  if (!globalThis.__envioCart) {
    globalThis.__envioCart = {
      items: [],
      subtotal: 0,
      descontos: 0,
      taxas: 0,
      total: 0,
      currency: "BRL",
    };
  }
  return globalThis.__envioCart;
}

function getShipmentStore(): Shipment[] {
  if (!globalThis.__envioShipmentsArray) {
    globalThis.__envioShipmentsArray = [];
  }
  return globalThis.__envioShipmentsArray;
}

export async function POST(request: NextRequest) {
  // Validate payload structure
  await request.json() as CheckoutPayload;

  // Get current cart items
  const cart = getCartStore();

  if (!cart.items || cart.items.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Carrinho vazio" },
      { status: 400 }
    );
  }

  // Create shipments from cart items
  const shipmentStore = getShipmentStore();
  const etiquetaIds: string[] = [];

  for (const item of cart.items) {
    const trackingCode = `BR${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const shipment: Shipment = {
      id: crypto.randomUUID(),
      codigoRastreio: trackingCode,
      destinatario: item.destino.cidadeUF?.split('/')[0] ?? "Destinatário",
      cidadeOrigem: item.origem.cidadeUF ?? `Origem`,
      cidadeDestino: item.destino.cidadeUF ?? `Destino`,
      servico: item.modalidade,
      status: "aguardando_coleta",
      atualizadoEm: new Date().toISOString(),
      prazoEstimado: `${item.prazoEstimadoDias} dias`,
      valorFrete: item.preco,
      servicoCodigo: item.selectionId,
    };

    shipmentStore.unshift(shipment);
    etiquetaIds.push(trackingCode);
  }

  // Clear cart after successful checkout
  cart.items = [];
  cart.subtotal = 0;
  cart.descontos = 0;
  cart.taxas = 0;
  cart.total = 0;

  return NextResponse.json({
    ok: true,
    orderId: `ord_${Date.now()}`,
    etiquetaIds,
    message: `${etiquetaIds.length} envio(s) criado(s) com sucesso`,
  });
}
