import { NextRequest, NextResponse } from "next/server";
import type { CartUpdatableFields } from "@/types/cart";
import { getCartStore, recomputeCartTotals } from "@/lib/api/stores";


export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await context.params;
  const patch = (await request.json()) as CartUpdatableFields;
  const cart = getCartStore();
  const index = cart.items.findIndex((item) => item.id === itemId);

  if (index === -1) {
    return NextResponse.json(
      { ok: false, message: "Item não encontrado" },
      { status: 404 },
    );
  }

  cart.items[index] = { ...cart.items[index], ...patch };
  recomputeCartTotals(cart);
  return NextResponse.json({ ok: true, item: cart.items[index] });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await context.params;
  const cart = getCartStore();
  const before = cart.items.length;
  cart.items = cart.items.filter((item) => item.id !== itemId);

  if (cart.items.length === before) {
    return NextResponse.json(
      { ok: false, message: "Item não encontrado" },
      { status: 404 },
    );
  }

  recomputeCartTotals(cart);
  return NextResponse.json({ ok: true });
}
