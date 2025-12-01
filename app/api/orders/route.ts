import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { ZodError } from "zod";
import { orderSchema } from "@/lib/validation/order";
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") as OrderStatus | null;
  const search = searchParams.get("q")?.toLowerCase() ?? "";

  await new Promise((resolve) => setTimeout(resolve, 300));

  const store = getOrderStore();
  let values = Array.from(store.values());

  if (statusFilter) {
    values = values.filter((order) => order.status === statusFilter);
  }

  if (search) {
    values = values.filter(
      (order) =>
        order.id.toLowerCase().includes(search) ||
        order.customer.name.toLowerCase().includes(search) ||
        order.customer.address.cep.includes(search),
    );
  }

  return NextResponse.json({ dados: values });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = orderSchema.parse(payload);

    await new Promise((resolve) => setTimeout(resolve, 400));

    const order: Order = {
      id: `ord_${nanoid(10)}`,
      createdAt: new Date().toISOString(),
      status: "NEW",
      customer: data.customer,
      package: data.package,
      preferences: data.preferences,
      items: data.items,
      nf: data.nf,
      events: [buildEvent("CREATED", "Pedido criado")],
    };

    const store = getOrderStore();
    store.set(order.id, order);

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          mensagem: "Dados inválidos",
          erros: error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensagem: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { mensagem: "Não foi possível criar o pedido" },
      { status: 500 },
    );
  }
}
