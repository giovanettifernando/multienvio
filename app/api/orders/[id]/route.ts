import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { Order, OrderEvent, OrderStatus } from "@/types/order";


declare global {
  var __envioOrders: Map<string, Order> | undefined;
}

function getOrderStore(): Map<string, Order> {
  if (!globalThis.__envioOrders) {
    globalThis.__envioOrders = new Map();
  }
  return globalThis.__envioOrders;
}

function buildEvent(type: OrderEvent["type"], description: string): OrderEvent {
  return {
    id: `ord_evt_${nanoid(8)}`,
    type,
    description,
    occurredAt: new Date().toISOString(),
  };
}

// GET /api/orders/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // latência mock
  await new Promise((resolve) => setTimeout(resolve, 250));

  const store = getOrderStore();
  const order = store.get(id);
  if (!order) {
    return NextResponse.json(
      { mensagem: "Pedido não encontrado" },
      { status: 404 },
    );
  }
  return NextResponse.json(order);
}

// PATCH /api/orders/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = await request.json();

  const store = getOrderStore();
  const order = store.get(id);
  if (!order) {
    return NextResponse.json(
      { mensagem: "Pedido não encontrado" },
      { status: 404 },
    );
  }

  if (payload.quoteId) {
    order.quoteId = payload.quoteId;
    order.status = "QUOTED";
    order.events = [buildEvent("QUOTED", "Cotação gerada"), ...order.events];
  }

  if (payload.selectedService) {
    order.selectedService = payload.selectedService;
    order.status = "READY_TO_SHIP";
    order.events = [
      buildEvent("SERVICE_SELECTED", "Serviço selecionado"),
      ...order.events,
    ];
  }

  if (payload.shipmentId) {
    order.shipmentId = payload.shipmentId;
    order.status = "SHIPPED";
    order.events = [
      buildEvent("LABEL_EMITTED", "Etiqueta emitida"),
      ...order.events,
    ];
  }

  if (payload.nf) {
    order.nf = payload.nf;
    order.events = [
      buildEvent("NOTE", "Notas fiscais atualizadas"),
      ...order.events,
    ];
  }

  if (payload.status) {
    const status = payload.status as OrderStatus;
    order.status = status;
    order.events = [
      buildEvent(
        status === "CANCELED" ? "CANCELED" : "NOTE",
        payload.description ?? "Status atualizado",
      ),
      ...order.events,
    ];
  }

  store.set(order.id, order);
  return NextResponse.json(order);
}

// DELETE /api/orders/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const store = getOrderStore();
  const order = store.get(id);
  if (!order) {
    return NextResponse.json(
      { mensagem: "Pedido não encontrado" },
      { status: 404 },
    );
  }

  order.status = "CANCELED";
  order.events = [buildEvent("CANCELED", "Pedido cancelado"), ...order.events];
  store.set(order.id, order);

  return NextResponse.json(order);
}
