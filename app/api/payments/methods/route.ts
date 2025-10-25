import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { cardSchema } from "@/lib/validation/billing";
import { getBillingStore } from "@/lib/billing/store";
import type { CardMethod } from "@/types/billing";

export const dynamic = "force-dynamic";

function detectBrand(number: string): CardMethod["brand"] {
  if (/^4/.test(number)) return "visa";
  if (/^5[1-5]/.test(number)) return "mastercard";
  if (/^3[47]/.test(number)) return "amex";
  if (/^6/.test(number)) return "hiper";
  return "other";
}

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const store = getBillingStore();
  return NextResponse.json({
    cards: Array.from(store.cards.values()),
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = cardSchema.parse(payload);
    const token = `tok_${nanoid(12)}`;
    const brand = detectBrand(data.number);
    const last4 = data.number.slice(-4);

    const method: CardMethod = {
      id: `card_${nanoid(8)}`,
      brand,
      last4,
      expMonth: data.expMonth,
      expYear: data.expYear,
      holder: data.holder,
      token,
    };

    const store = getBillingStore();
    if (store.cards.size === 0) {
      method.isDefault = true;
    }
    store.cards.set(method.id, method);

    return NextResponse.json(method, { status: 201 });
  } catch {
    return NextResponse.json(
      { mensagem: "Dados do cartão inválidos" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const payload = await request.json();
  const id = payload?.id as string | undefined;
  if (!id) {
    return NextResponse.json(
      { mensagem: "Informe o cartão" },
      { status: 400 },
    );
  }

  const store = getBillingStore();
  const card = store.cards.get(id);
  if (!card) {
    return NextResponse.json(
      { mensagem: "Cartão não encontrado" },
      { status: 404 },
    );
  }

  if (payload.isDefault) {
    store.cards.forEach((value) => {
      value.isDefault = value.id === card.id;
    });
  }

  return NextResponse.json({ cards: Array.from(store.cards.values()) });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { mensagem: "Informe o cartão" },
      { status: 400 },
    );
  }

  const store = getBillingStore();
  const existed = store.cards.delete(id);

  if (!existed) {
    return NextResponse.json(
      { mensagem: "Cartão não encontrado" },
      { status: 404 },
    );
  }

  if (store.cards.size > 0 && !Array.from(store.cards.values()).some((card) => card.isDefault)) {
    const first = store.cards.values().next().value;
    if (first) first.isDefault = true;
  }

  return NextResponse.json({ cards: Array.from(store.cards.values()) });
}
