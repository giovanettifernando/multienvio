import { NextRequest, NextResponse } from "next/server";
import type { Card } from "@/types/account";

export const dynamic = "force-dynamic";

declare global {
  var __envioCards: Card[] | undefined;
}

function getCardStore(): Card[] {
  if (!globalThis.__envioCards) {
    globalThis.__envioCards = [];
  }
  return globalThis.__envioCards;
}

function setPrimary(card: Card, store: Card[]) {
  if (!card.isPrimary) return;
  globalThis.__envioCards = store.map((item) => ({
    ...item,
    isPrimary: item.id === card.id,
  }));
}

export async function GET() {
  const cards = getCardStore();
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const id = crypto.randomUUID();
  const digits = String(body.number ?? "").replace(/\D/g, "");
  const last4 = digits.slice(-4) || "0000";
  const brand =
    digits.startsWith("4") ? "Visa" : digits.startsWith("5") ? "Mastercard" : "Cartão";
  const card: Card = {
    id,
    holderName: String(body.holderName ?? "Titular"),
    last4,
    brand,
    expMonth: Number(body.expMonth ?? 1),
    expYear: Number(body.expYear ?? 30) + 2000,
    isPrimary: Boolean(body.isPrimary),
  };

  const store = getCardStore();
  store.push(card);
  setPrimary(card, store);

  return NextResponse.json({ ok: true, card });
}

export async function DELETE() {
  globalThis.__envioCards = [];
  return NextResponse.json({ ok: true });
}
