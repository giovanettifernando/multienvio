import { NextRequest, NextResponse } from "next/server";
import { getCardsStore } from "@/lib/api/stores";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json()) as Record<string, unknown>;
  const cards = getCardsStore();
  const index = cards.findIndex((item) => item.id === id);
  if (index < 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  cards[index] = { ...cards[index], ...body };
  if (cards[index].isPrimary) {
    cards.forEach((card, idx) => {
      if (idx !== index) {
        card.isPrimary = false;
      }
    });
  }
  return NextResponse.json({ ok: true, card: cards[index] });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const index = getCardsStore().findIndex((item) => item.id === id);
  if (index < 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  getCardsStore().splice(index, 1);
  return NextResponse.json({ ok: true });
}
