import { NextRequest, NextResponse } from "next/server";
import type { Cart, CartItem } from "@/types/cart";

export const dynamic = "force-dynamic";

declare global {
  var __envioCart: Cart | undefined;
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

function recomputeCartTotals(cart: Cart) {
  const subtotal = cart.items.reduce(
    (accumulator, item) => accumulator + item.preco * item.quantidade,
    0,
  );
  const descontos = 0;
  const taxas = 0;
  const total = subtotal - descontos + taxas;
  globalThis.__envioCart = { ...cart, subtotal, descontos, taxas, total };
}

export async function GET() {
  const cart = getCartStore();
  recomputeCartTotals(cart);
  return NextResponse.json(globalThis.__envioCart);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<CartItem> & {
    selectionId: string;
    quoteId: string;
  };

  const id = crypto.randomUUID();
  const item: CartItem = {
    id,
    selectionId: body.selectionId,
    quoteId: body.quoteId,
    transportadora: body.transportadora ?? "Transportadora",
    modalidade: body.modalidade ?? "Modalidade",
    prazoEstimadoDias: body.prazoEstimadoDias ?? 3,
    preco: body.preco ?? 0,
    quantidade: body.quantidade ?? 1,
    origem: body.origem!,
    destino: body.destino!,
    devolucao: Boolean(body.devolucao),
    coleta: Boolean(body.coleta),
    volumes: body.volumes ?? [],
    pesoTotalKg: body.pesoTotalKg ?? 0,
    pesoCubadoTotalKg: body.pesoCubadoTotalKg ?? 0,
    documento: body.documento ?? "DECLARACAO",
    aceitouDeclaracao: Boolean(body.aceitouDeclaracao),
    valorSeguro: body.valorSeguro ?? null,
    avisoRecebimento: body.avisoRecebimento ?? false,
    status: body.status ?? "OK",
  };

  const cart = getCartStore();
  cart.items.push(item);
  recomputeCartTotals(cart);

  return NextResponse.json({ ok: true, item });
}

export async function DELETE() {
  const cart = getCartStore();
  cart.items = [];
  recomputeCartTotals(cart);
  return NextResponse.json({ ok: true });
}
