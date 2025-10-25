import { NextResponse } from "next/server";
import { applyLedgerEntry, getBillingStore } from "@/lib/billing/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json();
  const topupId = payload?.topupId as string | undefined;
  if (!topupId) {
    return NextResponse.json(
      { mensagem: "Informe o topupId" },
      { status: 400 },
    );
  }

  const store = getBillingStore();
  const topup = store.pixTopups.get(topupId);
  if (!topup) {
    return NextResponse.json(
      { mensagem: "Top-up não encontrado" },
      { status: 404 },
    );
  }

  if (topup.status === "CONFIRMED") {
    return NextResponse.json(topup);
  }

  topup.status = "CONFIRMED";
  store.pixTopups.set(topup.id, topup);

  const entry = applyLedgerEntry({
    id: `led_${topup.id}`,
    occurredAt: new Date().toISOString(),
    type: "CREDIT",
    source: "TOPUP_PIX",
    amount: topup.amount,
    currency: "BRL",
    description: "Crédito via PIX",
    ref: { topupId: topup.id },
  });

  return NextResponse.json({ topup, entry });
}
